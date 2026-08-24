import type { VercelRequest, VercelResponse } from "@vercel/node";

import { query, queryOne } from "../_lib/db";
import { applyCommonHeaders, methodNotAllowed, readBody } from "../_lib/http";

/**
 * POST /api/partner/telegram-webhook — Telegram delivers bot updates here.
 *
 * The token must be redeemed BY THE BOT, which is the whole reason Telegram verification could not
 * be done from the browser: handing the partner a token and letting the page submit it back proves
 * only that they can read their own screen. Arriving here means the token was pasted into a real
 * Telegram chat, so the sender genuinely controls that account.
 *
 * This URL is public, so the shared secret header is the only thing standing between it and forged
 * verifications. Telegram echoes the value registered with setWebhook on every call.
 *
 * Always answers 200: a non-200 makes Telegram retry the same update for hours.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCommonHeaders(res);
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  const expected = process.env.PARTNER_TELEGRAM_WEBHOOK_SECRET;
  const provided = req.headers["x-telegram-bot-api-secret-token"];
  if (!expected || provided !== expected) {
    // Say nothing useful: this endpoint is reachable by anyone who guesses the URL.
    return res.status(404).json({ error: "Not found" });
  }

  const update = readBody(req) as any;
  const message = update?.message ?? update?.edited_message;
  const text: string | undefined = message?.text;
  const from = message?.from;
  const chatId = message?.chat?.id;

  // Not a /verify message — acknowledge and ignore.
  if (!text || !from?.id || !chatId) return res.status(200).json({ ok: true });

  const match = /^\/verify(?:@\w+)?\s+([A-Za-z0-9-]{4,32})\s*$/.exec(text.trim());
  if (!match) {
    await reply(chatId, "Send /verify followed by the code shown in the 0xMarkets partner portal.");
    return res.status(200).json({ ok: true });
  }

  const submitted = match[1].toUpperCase();

  try {
    // Consume the challenge atomically so a token cannot be redeemed twice.
    const challenge = await queryOne<{ address: string; handle: string }>(
      `DELETE FROM partner_contact_challenge
        WHERE upper(secret) = $1 AND channel = 'telegram' AND expires_at > now()
        RETURNING address, handle`,
      [submitted]
    );

    if (!challenge) {
      await reply(chatId, "That code is not valid or has expired. Start again in the partner portal.");
      return res.status(200).json({ ok: true });
    }

    // Store the numeric id as the identity — usernames are mutable and can be reclaimed.
    const handle = from.username ? `@${from.username}` : from.first_name ?? challenge.handle;
    await query(
      `INSERT INTO partner_contact (address, channel, handle, channel_user_id, verified_at, updated_at)
            VALUES ($1, 'telegram', $2, $3, now(), now())
       ON CONFLICT (address) DO UPDATE
          SET channel = 'telegram', handle = EXCLUDED.handle,
              channel_user_id = EXCLUDED.channel_user_id, verified_at = now(), updated_at = now()`,
      [challenge.address, handle, String(from.id)]
    );

    await reply(chatId, "Verified. You can go back to the partner portal.");
    return res.status(200).json({ ok: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[partner-api] telegram-webhook", error);
    return res.status(200).json({ ok: true });
  }
}

/** Best effort: a failed reply must not cause Telegram to retry a verification we already applied. */
async function reply(chatId: number | string, text: string) {
  const token = process.env.PARTNER_TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch {
    /* ignore */
  }
}
