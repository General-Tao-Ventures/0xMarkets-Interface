import useSWR from "swr";

import { UI_VERSION } from "config/env";
import { isDevelopment } from "config/env";
import { REQUIRED_UI_VERSION_KEY } from "config/localStorage";
import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";

const EDGE_CONFIG_ID = "ecfg_bu4y1jkuaum21lz3pvyj2zrgdsoj";
const EDGE_CONFIG_TOKEN = import.meta.env.VITE_EDGE_CONFIG_TOKEN;

export function useHasOutdatedUi() {
  const { chainId } = useChainId();
  const { active } = useWallet();

  const { data: minVersion } = useSWR(
    EDGE_CONFIG_TOKEN ? [chainId, active, "uiVersion"] : null,
    {
      fetcher: async () => {
        const url = `https://edge-config.vercel.com/${EDGE_CONFIG_ID}/item/uiVersion?token=${EDGE_CONFIG_TOKEN}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        return response.json();
      },
    }
  );

  let hasOutdatedUi = false;

  if (typeof minVersion === "number" && minVersion > UI_VERSION) {
    hasOutdatedUi = true;
  }

  if (isDevelopment()) {
    const localStorageVersion = localStorage.getItem(REQUIRED_UI_VERSION_KEY);

    if (localStorageVersion) {
      hasOutdatedUi = Boolean(parseFloat(localStorageVersion) > UI_VERSION);
    }
  }

  return hasOutdatedUi;
}
