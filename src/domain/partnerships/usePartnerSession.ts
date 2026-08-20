import { useCallback, useEffect, useRef, useState } from "react";
import { useSignMessage } from "wagmi";

import useWallet from "lib/wallets/useWallet";

export type PartnerContact = {
  address: string;
  name: string | null;
  channel: "discord" | "telegram" | "email" | null;
  handle: string | null;
  verified: boolean;
  verifiedAt: string | null;
};

const STORAGE_KEY = "partner-session";

type StoredSession = { address: string; token: string; expiresAt: number };

/** One token per address, kept in localStorage so a reload does not re-prompt the wallet. */
function readStored(address: string | undefined): string | undefined {
  if (!address) return undefined;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const stored = JSON.parse(raw) as StoredSession;
    if (stored.address !== address.toLowerCase()) return undefined;
    // A minute of slack so a token that expires mid-request is treated as already gone.
    if (stored.expiresAt < Date.now() + 60_000) return undefined;
    return stored.token;
  } catch (error) {
    return undefined;
  }
}

function writeStored(session: StoredSession | undefined) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    /* private browsing — the session simply does not survive a reload */
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/partner/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Something went wrong. Try again.");
  return body as T;
}

/**
 * Wallet sign-in for the contact API.
 *
 * Signing is deliberately NOT automatic. An unprompted signature request the moment a page mounts
 * is indistinguishable from a phishing attempt, and re-prompting on every mount is what made the
 * first version of this unusable — so the wallet is only asked when the partner presses the button,
 * and the resulting token is reused until it expires.
 */
export function usePartnerSession() {
  const { account } = useWallet();
  const { signMessageAsync } = useSignMessage();

  const [token, setToken] = useState<string | undefined>(() => readStored(account));
  const [contact, setContact] = useState<PartnerContact | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Guards a second sign-in kicking off while the wallet dialog is still open.
  const inFlight = useRef(false);

  useEffect(() => {
    setToken(readStored(account));
    setContact(undefined);
    setError(undefined);
  }, [account]);

  const authed = useCallback(
    <T>(path: string, init: RequestInit = {}) =>
      call<T>(path, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } }),
    [token]
  );

  const refresh = useCallback(async () => {
    if (!token) return undefined;
    try {
      const next = await authed<PartnerContact>("contact");
      setContact(next);
      return next;
    } catch (error) {
      // The only way an authenticated read fails is a token the server no longer accepts.
      writeStored(undefined);
      setToken(undefined);
      return undefined;
    }
  }, [authed, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async () => {
    if (!account || inFlight.current) return undefined;
    inFlight.current = true;
    setIsLoading(true);
    setError(undefined);
    try {
      const { nonce, message } = await call<{ nonce: string; message: string }>("nonce", {
        method: "POST",
        body: JSON.stringify({ address: account }),
      });
      const signature = await signMessageAsync({ message });
      const session = await call<{ token: string; expiresAt: number }>("session", {
        method: "POST",
        body: JSON.stringify({ address: account, nonce, signature }),
      });

      writeStored({ address: account.toLowerCase(), token: session.token, expiresAt: session.expiresAt });
      setToken(session.token);
      return session.token;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not sign in.";
      // A rejected signature is a choice, not a failure — do not shout about it.
      setError(/rejected|denied|User denied/i.test(message) ? undefined : message);
      return undefined;
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }, [account, signMessageAsync]);

  const signOut = useCallback(() => {
    writeStored(undefined);
    setToken(undefined);
    setContact(undefined);
  }, []);

  const saveName = useCallback(
    async (name: string) => {
      const next = await authed<PartnerContact>("contact", { method: "POST", body: JSON.stringify({ name }) });
      setContact(next);
      return next;
    },
    [authed]
  );

  const startVerification = useCallback(
    (channel: PartnerContact["channel"], handle: string) =>
      authed<{
        channel: string;
        handle: string;
        expiresAt: string;
        instruction: string | null;
        devCode: string | null;
      }>("contact-start", { method: "POST", body: JSON.stringify({ channel, handle }) }),
    [authed]
  );

  const verify = useCallback(
    async (code: string) => {
      const next = await authed<PartnerContact>("contact-verify", { method: "POST", body: JSON.stringify({ code }) });
      setContact(next);
      return next;
    },
    [authed]
  );

  return {
    isSignedIn: Boolean(token),
    contact,
    isLoading,
    error,
    signIn,
    signOut,
    refresh,
    saveName,
    startVerification,
    verify,
  };
}
