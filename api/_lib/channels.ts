import crypto from "node:crypto";

import { query, queryOne } from "./db";

export type Channel = "discord" | "telegram" | "email";

const CHALLENGE_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 6;

export const isChannel = (value: unknown): value is Channel =>
  value === "discord" || value === "telegram" || value === "email";

/** Loose on purpose — we are checking for a typo, not policing what a mail server will accept. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEGRAM_RE = /^@?[A-Za-z0-9_]{5,32}$/;

export function normaliseHandle(channel: Channel, raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const handle = raw.trim();

  if (channel === "email") return EMAIL_RE.test(handle) ? handle.toLowerCase() : undefined;
  if (channel === "telegram") return TELEGRAM_RE.test(handle) ? `@${handle.replace(/^@/, "")}` : undefined;
  return handle.length >= 2 && handle.length <= 64 ? handle : undefined;
}

/** Six digits, uniformly drawn. `randomInt` rather than `Math.random` — this is a credential. */
const sixDigits = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

/** Telegram's flow is "send this to the bot", so the secret has to be readable out loud. */
const botToken = () => {
  const raw = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
};

export async function startChallenge(address: string, channel: Channel, handle: string) {
  const id = crypto.randomBytes(12).toString("hex");
  const secret = channel === "telegram" ? botToken() : sixDigits();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  // One live challenge per partner: starting a new one abandons whatever was in flight, so a
  // half-finished email attempt cannot be completed after they switch to Telegram.
  await query("DELETE FROM partner_contact_challenge WHERE address = $1 OR expires_at < now()", [address]);
  await query(
    `INSERT INTO partner_contact_challenge (id, address, channel, handle, secret, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, address, channel, handle, secret, expiresAt]
  );

  const delivery = await deliver(channel, handle, secret);

  return {
    id,
    channel,
    handle,
    expiresAt: expiresAt.toISOString(),
    delivery,
    // Only ever populated when PARTNER_DEV_ECHO_CODE is on — see `deliver`.
    devCode: delivery.echoed ? secret : undefined,
  };
}

type Delivery = { sent: boolean; echoed: boolean; instruction?: string; reason?: string };

/**
 * Hands the secret to the partner over their chosen channel.
 *
 * Nothing here fakes success. If a channel has no provider configured it says so, and the caller
 * surfaces that instead of pretending a message went out. The one exception is an explicit
 * `PARTNER_DEV_ECHO_CODE`, which returns the code to the browser so a developer can complete the
 * flow locally — it must never be set in production.
 */
async function deliver(channel: Channel, handle: string, secret: string): Promise<Delivery> {
  const echo = process.env.PARTNER_DEV_ECHO_CODE === "1";

  if (channel === "telegram") {
    const bot = process.env.PARTNER_TELEGRAM_BOT || "@0xMarketsBot";
    // The token has to be redeemed BY THE BOT, reporting which Telegram account sent it. Handing
    // it to the browser and letting the browser submit it back would verify nothing at all — the
    // partner would just be reading their own token. So this stays unavailable until the bot
    // exists, and the instruction below is the copy it will use when it does.
    return {
      sent: false,
      echoed: echo,
      instruction: `Send "/verify ${secret}" to ${bot}`,
      reason: "Telegram verification is not connected yet.",
    };
  }

  if (channel === "discord") {
    return { sent: false, echoed: echo, reason: "Discord verification is not connected yet." };
  }

  const apiKey = process.env.PARTNER_RESEND_API_KEY;
  const from = process.env.PARTNER_EMAIL_FROM;
  if (!apiKey || !from) {
    return {
      sent: false,
      echoed: echo,
      reason: echo ? undefined : "Email delivery is not configured on this deployment.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: handle,
        subject: `${secret} is your 0xMarkets partner code`,
        text: `Your 0xMarkets partner verification code is ${secret}.\n\nIt expires in 15 minutes. If you did not ask for it, ignore this email.`,
      }),
    });
    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error("[partner-api] email delivery failed", response.status, await response.text());
      return { sent: false, echoed: echo, reason: "Could not send the email. Try again." };
    }
    return { sent: true, echoed: false };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[partner-api] email delivery threw", error);
    return { sent: false, echoed: echo, reason: "Could not send the email. Try again." };
  }
}

export type VerifyResult =
  | { ok: true; channel: Channel; handle: string }
  | { ok: false; reason: "none" | "expired" | "attempts" | "mismatch" };

export async function verifyChallenge(address: string, submitted: string): Promise<VerifyResult> {
  const row = await queryOne<{
    id: string;
    channel: Channel;
    handle: string;
    secret: string;
    attempts: number;
    expires_at: Date;
  }>(
    `SELECT id, channel, handle, secret, attempts, expires_at
       FROM partner_contact_challenge WHERE address = $1 ORDER BY created_at DESC LIMIT 1`,
    [address]
  );

  if (!row) return { ok: false, reason: "none" };
  if (row.expires_at.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "attempts" };

  const expected = Buffer.from(row.secret.toUpperCase());
  const provided = Buffer.from(submitted.trim().toUpperCase());
  const matches = expected.length === provided.length && crypto.timingSafeEqual(expected, provided);

  if (!matches) {
    await query("UPDATE partner_contact_challenge SET attempts = attempts + 1 WHERE id = $1", [row.id]);
    return { ok: false, reason: "mismatch" };
  }

  await query(
    `INSERT INTO partner_contact (address, channel, handle, verified_at, updated_at)
          VALUES ($1, $2, $3, now(), now())
     ON CONFLICT (address) DO UPDATE
        SET channel = EXCLUDED.channel, handle = EXCLUDED.handle, verified_at = now(), updated_at = now()`,
    [address, row.channel, row.handle]
  );
  await query("DELETE FROM partner_contact_challenge WHERE address = $1", [address]);

  return { ok: true, channel: row.channel, handle: row.handle };
}
