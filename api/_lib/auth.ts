import crypto from "node:crypto";

import type { VercelRequest } from "@vercel/node";
import { recoverMessageAddress } from "viem";

import { query, queryOne } from "./db";

const NONCE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const isAddress = (value: unknown): value is string =>
  typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);

function secret(): string {
  const value = process.env.PARTNER_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("PARTNER_SESSION_SECRET must be set to at least 32 characters");
  }
  return value;
}

/** The text the partner actually reads in their wallet. Spell out that it costs nothing. */
export function loginMessage(address: string, nonce: string) {
  return [
    "0xMarkets — partner sign-in",
    "",
    "Sign this message to prove you control this wallet.",
    "It is free, it is not a transaction, and it moves no funds.",
    "",
    `Wallet: ${address}`,
    `Nonce: ${nonce}`,
  ].join("\n");
}

export async function issueNonce(address: string) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS);

  // Opportunistic sweep — there is no cron here, and the table would otherwise grow forever.
  await query("DELETE FROM partner_nonce WHERE expires_at < now()");
  await query("INSERT INTO partner_nonce (nonce, address, expires_at) VALUES ($1, $2, $3)", [
    nonce,
    address.toLowerCase(),
    expiresAt,
  ]);

  return { nonce, message: loginMessage(address, nonce), expiresAt: expiresAt.toISOString() };
}

/** Spends the nonce. Returns false if it was already used, expired, or issued to another wallet. */
export async function consumeNonce(address: string, nonce: string) {
  const rows = await query<{ address: string }>(
    "DELETE FROM partner_nonce WHERE nonce = $1 AND address = $2 AND expires_at > now() RETURNING address",
    [nonce, address.toLowerCase()]
  );
  return rows.length === 1;
}

const b64 = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/**
 * Stateless session token: `base64(address.expiry).base64(hmac)`.
 *
 * Stateless on purpose — a DB round trip per request would be a lot of Cloud SQL traffic for a
 * question the HMAC already answers, and it means the app can hold one token across a page reload
 * instead of re-prompting the wallet on every mount.
 */
export function issueSession(address: string) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${address.toLowerCase()}.${expiresAt}`;
  const signature = crypto.createHmac("sha256", secret()).update(payload).digest();
  return { token: `${b64(payload)}.${b64(signature)}`, expiresAt };
}

export function verifySession(token: string | undefined): string | undefined {
  if (!token) return undefined;
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return undefined;

  let payload: string;
  try {
    payload = Buffer.from(payloadPart, "base64url").toString();
  } catch {
    return undefined;
  }

  const expected = crypto.createHmac("sha256", secret()).update(payload).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signaturePart, "base64url");
  } catch {
    return undefined;
  }
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return undefined;

  const [address, expiry] = payload.split(".");
  if (!isAddress(address) || Number(expiry) < Date.now()) return undefined;

  return address;
}

/** The address this request is authenticated as, or undefined. */
export function authenticate(req: VercelRequest): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  return verifySession(header.slice("Bearer ".length).trim());
}

/**
 * EOA signatures only. A smart-contract wallet would need an ERC-1271 call against an RPC, which
 * this endpoint has no client for — those partners cannot sign in yet, and get a clear error
 * rather than a silent rejection.
 */
export async function recoverSigner(message: string, signature: string) {
  try {
    return (await recoverMessageAddress({ message, signature: signature as `0x${string}` })).toLowerCase();
  } catch {
    return undefined;
  }
}

export async function findContact(address: string) {
  return queryOne<{
    address: string;
    name: string | null;
    channel: string | null;
    handle: string | null;
    verified_at: Date | null;
  }>("SELECT address, name, channel, handle, verified_at FROM partner_contact WHERE address = $1", [
    address.toLowerCase(),
  ]);
}
