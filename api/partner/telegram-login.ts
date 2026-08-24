import crypto from "node:crypto";

import type { VercelRequest, VercelResponse } from "@vercel/node";

import { authenticate } from "../_lib/auth";
import { query } from "../_lib/db";
import { applyCommonHeaders, badRequest, methodNotAllowed, readBody, serverError } from "../_lib/http";

/** Telegram signs the payload rather than giving us a token to exchange, so this is the whole check. */
const MAX_AGE_SECONDS = 300;

/**
 * POST /api/partner/telegram-login — finish Telegram Login Widget verification.
 *
 * Telegram hands the browser a signed payload instead of an OAuth code, so there is nothing to
 * exchange: the proof is the HMAC. `hash` is HMAC-SHA256 of the remaining fields, sorted and
 * newline-joined, keyed by SHA256 of the bot token. Only someone holding that token could produce
 * it, so a valid hash means Telegram really did authenticate this account.
 *
 * The payload is otherwise entirely attacker-controlled, so it is checked before anything is
 * written: signature first, then freshness — without an age limit a captured payload would be
 * replayable forever.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCommonHeaders(res);
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  const address = authenticate(req);
  if (!address) return res.status(401).json({ error: "Sign in with your wallet first." });

  const token = process.env.PARTNER_TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(503).json({ error: "Telegram verification is not configured." });

  const payload = readBody(req) as Record<string, string | number | undefined>;
  const { hash, ...fields } = payload as Record<string, any>;
  if (typeof hash !== "string" || !fields.id || !fields.auth_date) {
    return badRequest(res, "That Telegram response is incomplete.");
  }

  try {
    const dataCheckString = Object.keys(fields)
      .filter((k) => fields[k] !== undefined && fields[k] !== null)
      .sort()
      .map((k) => `${k}=${fields[k]}`)
      .join("\n");

    const secretKey = crypto.createHash("sha256").update(token).digest();
    const expected = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    const a = Buffer.from(expected);
    const b = Buffer.from(hash);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: "That Telegram sign-in could not be verified." });
    }

    const age = Math.floor(Date.now() / 1000) - Number(fields.auth_date);
    if (!Number.isFinite(age) || age > MAX_AGE_SECONDS || age < -60) {
      return res.status(400).json({ error: "That Telegram sign-in has expired. Try again." });
    }

    // The numeric id is the identity; the username is display only and its owner can change it.
    const handle = fields.username ? `@${fields.username}` : String(fields.first_name ?? "Telegram user");
    await query(
      `INSERT INTO partner_contact (address, channel, handle, channel_user_id, verified_at, updated_at)
            VALUES ($1, 'telegram', $2, $3, now(), now())
       ON CONFLICT (address) DO UPDATE
          SET channel = 'telegram', handle = EXCLUDED.handle,
              channel_user_id = EXCLUDED.channel_user_id, verified_at = now(), updated_at = now()`,
      [address, handle, String(fields.id)]
    );

    return res.status(200).json({ address, channel: "telegram", handle, verified: true });
  } catch (error) {
    return serverError(res, "telegram-login", error);
  }
}
