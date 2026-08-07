import { FormEvent, useMemo, useState } from "react";

import { SITE_PASSWORD_UNLOCKED_KEY } from "config/localStorage";

import Button from "components/Button/Button";

import "styles/Font.css";
import "styles/Shared.scss";
import "components/Button/Button.scss";

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
  const showGate = gateEnabled && !unlocked;

  if (!showGate) {
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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-16 text-typography-primary">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[420px] rounded-8 border-1/2 border-slate-600 bg-slate-900 p-24"
      >
        <div className="mb-8 text-12 font-medium uppercase tracking-[0.08em] text-typography-secondary">
          0xMarkets
        </div>
        <h1 className="mb-8 text-h2 text-typography-primary">Soft launch lock</h1>
        <p className="mb-20 text-body-medium text-typography-secondary">Enter the invite password to trade.</p>
        <label className="mb-8 block text-body-small text-typography-secondary" htmlFor="site-password">
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
          className="text-input-bg mb-12 w-full border-0 px-12 py-10 text-body-medium text-typography-primary outline-none ring-1 ring-slate-600 focus:ring-blue-300"
          placeholder="••••••••"
        />
        {error ? <p className="mb-12 text-body-small text-red-400">Incorrect password.</p> : null}
        <Button type="submit" variant="primary-action" className="w-full" size="medium">
          Unlock
        </Button>
      </form>
    </div>
  );
}
