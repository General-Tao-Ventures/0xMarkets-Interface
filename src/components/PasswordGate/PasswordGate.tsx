import { FormEvent, useMemo, useState } from "react";

import { SITE_PASSWORD_UNLOCKED_KEY } from "config/localStorage";

const SITE_PASSWORD = import.meta.env.VITE_SITE_PASSWORD as string | undefined;

function isUnlocked(): boolean {
  if (!SITE_PASSWORD) return true;
  try {
    return localStorage.getItem(SITE_PASSWORD_UNLOCKED_KEY) === "1";
  } catch {
    return false;
  }
}

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const gateEnabled = useMemo(() => Boolean(SITE_PASSWORD), []);

  if (!gateEnabled || unlocked) {
    return <>{children}</>;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password === SITE_PASSWORD) {
      try {
        localStorage.setItem(SITE_PASSWORD_UNLOCKED_KEY, "1");
      } catch {
        // ignore storage failures; unlock for this session anyway
      }
      setUnlocked(true);
      setError(false);
      return;
    }
    setError(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#030E17] px-16 text-white">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[420px] rounded-8 border border-slate-600/60 bg-slate-900/80 p-24 shadow-lg"
      >
        <div className="mb-8 text-12 uppercase tracking-[0.14em] text-slate-400">0xMarkets</div>
        <h1 className="mb-8 text-24 font-medium">Soft launch lock</h1>
        <p className="mb-20 text-14 leading-relaxed text-slate-400">
          Enter the invite password to trade. Hint: it lives in a Vercel env var named{" "}
          <code className="rounded-4 bg-slate-800 px-6 py-2 text-green-400">VITE_SITE_PASSWORD</code> — go find it.
        </p>
        <label className="mb-8 block text-13 text-slate-300" htmlFor="site-password">
          Password
        </label>
        <input
          id="site-password"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError(false);
          }}
          className="mb-12 w-full rounded-4 border border-slate-600 bg-slate-950 px-12 py-10 text-14 outline-none focus:border-green-500"
          placeholder="••••••••"
        />
        {error ? <p className="mb-12 text-13 text-red-400">Nope — try again (or peek at the env var).</p> : null}
        <button
          type="submit"
          className="w-full rounded-4 bg-green-500 px-12 py-10 text-14 font-medium text-black transition-opacity hover:opacity-90"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
