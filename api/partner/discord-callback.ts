import type { VercelRequest, VercelResponse } from "@vercel/node";

import { query, queryOne } from "../_lib/db";
import { applyCommonHeaders, methodNotAllowed } from "../_lib/http";

/**
 * GET /api/partner/discord-callback — Discord sends the partner back here.
 *
 * This is a top-level browser redirect, so there is no session header to read. The `state`
 * parameter is the only credential, and it is consumed on first use: a replayed callback finds
 * nothing and fails. The partner is redirected back into the app either way — an error page served
 * from an API route would strand them outside the product.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCommonHeaders(res);
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const origin = process.env.PARTNER_APP_ORIGIN ?? "http://localhost:3010";
  const back = (status: string) => res.redirect(302, `${origin}/#/partnerships/start?discord=${status}`);

  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  if (!code || !state) return back("cancelled");

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return back("unconfigured");

  try {
    // Consume the state. RETURNING makes the lookup and the delete a single atomic step, so two
    // concurrent callbacks cannot both succeed.
    const challenge = await queryOne<{ address: string }>(
      `DELETE FROM partner_contact_challenge
        WHERE secret = $1 AND channel = 'discord' AND expires_at > now()
        RETURNING address`,
      [state]
    );
    if (!challenge) return back("expired");

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) {
      // eslint-disable-next-line no-console
      console.error("[partner-api] discord token exchange failed", tokenRes.status, await tokenRes.text());
      return back("failed");
    }
    const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string };
    if (!accessToken) return back("failed");

    const meRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!meRes.ok) return back("failed");
    const me = (await meRes.json()) as { id: string; username: string; global_name?: string };

    await query(
      `INSERT INTO partner_contact (address, channel, handle, channel_user_id, verified_at, updated_at)
            VALUES ($1, 'discord', $2, $3, now(), now())
       ON CONFLICT (address) DO UPDATE
          SET channel = 'discord', handle = EXCLUDED.handle,
              channel_user_id = EXCLUDED.channel_user_id, verified_at = now(), updated_at = now()`,
      [challenge.address, me.global_name || me.username, me.id]
    );

    return back("verified");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[partner-api] discord-callback", error);
    return back("failed");
  }
}
