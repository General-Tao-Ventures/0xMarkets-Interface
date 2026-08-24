import { Trans } from "@lingui/macro";
import { useEffect, useRef, useState } from "react";

/**
 * Telegram's Login Widget.
 *
 * Telegram injects its own button via a script tag and calls a global function with a signed
 * payload, so it cannot be a plain React component — the script is mounted into a ref and the
 * callback is hung off `window` for as long as this is on screen.
 *
 * The widget only renders on the domain bound to the bot with BotFather `/setdomain`; on any other
 * origin Telegram silently refuses, which is why the fallback note below matters.
 */
export function TelegramLoginButton({
  botUsername,
  onAuth,
}: {
  botUsername: string;
  onAuth: (payload: Record<string, unknown>) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // Callers pass an inline arrow, so `onAuth` is a new reference every render. Keeping it in a ref
  // means the effect below depends only on the bot name — otherwise Telegram's script is torn down
  // and re-injected on every render, which flickers and never finishes loading.
  const onAuthRef = useRef(onAuth);
  useEffect(() => {
    onAuthRef.current = onAuth;
  }, [onAuth]);

  useEffect(() => {
    const node = host.current;
    if (!node) return undefined;

    const callbackName = `onTelegramAuth_${Math.random().toString(36).slice(2)}`;
    (window as any)[callbackName] = (user: Record<string, unknown>) => onAuthRef.current(user);

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername.replace(/^@/, ""));
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-onauth", `${callbackName}(user)`);
    script.onerror = () => setFailed(true);
    node.appendChild(script);

    return () => {
      delete (window as any)[callbackName];
      node.replaceChildren();
    };
  }, [botUsername]);

  return (
    <div>
      <div ref={host} />
      {failed && (
        <p className="mt-8 text-11 text-red-500">
          <Trans>Telegram's widget could not load. Check the bot's domain is set in BotFather.</Trans>
        </p>
      )}
    </div>
  );
}
