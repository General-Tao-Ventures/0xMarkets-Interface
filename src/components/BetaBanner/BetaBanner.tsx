import { useLocalStorageSerializeKey } from "lib/localStorage";
import { BETA_BANNER_DISMISSED_KEY } from "config/localStorage";

import CloseIcon from "img/ic_close.svg?react";

export function BetaBanner() {
  const [isDismissed, setIsDismissed] = useLocalStorageSerializeKey(BETA_BANNER_DISMISSED_KEY, false);

  if (isDismissed) return null;

  return (
    <div className="relative bg-yellow-500/20 px-40 py-12 text-center text-16 font-normal text-yellow-300">
      You're early. This is the 0xMarkets <span className="font-medium">BETA</span> on Base Mainnet.{" "}
      <span className="font-medium">Funds and trades are real</span>. Any issues or feedback — please tell us in{" "}
      <a
        href="https://discord.gg/zGkW2kTsGM"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-white"
      >
        Discord
      </a>
      .
      <button
        type="button"
        aria-label="Dismiss beta banner"
        className="absolute right-12 top-1/2 -translate-y-1/2 rounded-4 p-4 text-yellow-300/80 transition-colors hover:bg-yellow-500/20 hover:text-yellow-200"
        onClick={() => setIsDismissed(true)}
      >
        <CloseIcon className="size-16" />
      </button>
    </div>
  );
}
