import crypto from "node:crypto";

import type { VercelRequest, VercelResponse } from "@vercel/node";

import { authenticate } from "../_lib/auth";
import { query } from "../_lib/db";
import { applyCommonHeaders, methodNotAllowed, serverError } from "../_lib/http";

/**
 * POST /api/partner/discord-start — begin Discord OAuth.
 *
 * The `state` is the whole security story here. Discord's callback arrives as a plain browser
 * redirect with no Authorization header, so the callback cannot know who the caller is except by
 * what `state` maps to. It is therefore: 32 random bytes, stored server-side against this partner's
 * address, single-use, and short-lived. Without that, anyone could complete the flow and attach
 * their own Discord account to someone else's partner address.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCommonHeaders(res);
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  const address = authenticate(req);
  if (!address) return res.status(401).json({ error: "Sign in with your wallet first." });

  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.status(503).json({ error: "Discord verification is not configured on this deployment." });
  }

  try {
    const state = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await query("DELETE FROM partner_contact_challenge WHERE address = $1 OR expires_at < now()", [address]);
    await query(
      `INSERT INTO partner_contact_challenge (id, address, channel, handle, secret, expires_at)
       VALUES ($1, $2, 'discord', '', $3, $4)`,
      [crypto.randomBytes(12).toString("hex"), address, state, expiresAt]
    );

    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    // `identify` only: we need the account id and username, nothing else. No email, no guilds.
    url.searchParams.set("scope", "identify");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "consent");

    return res.status(200).json({ url: url.toString(), expiresAt: expiresAt.toISOString() });
  } catch (error) {
    return serverError(res, "discord-start", error);
  }
}
