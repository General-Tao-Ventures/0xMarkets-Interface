import {
  AnyChainId,
  SOURCE_BASE_MAINNET,
  BASE_MAINNET,
  BASE_SEPOLIA,
  LOCALHOST,
} from "config/chains";

import gmIcon from "img/gm_icon.svg";
import base from "img/ic_base_24.svg";
import esGMXIcon from "img/ic_esgmx_40.svg";
import glpIcon from "img/ic_glp_40.svg";
import glvIcon from "img/ic_glv_40.svg";
import gmxIcon from "img/ic_gmx_40.svg";
import gmxOutlineIcon from "img/ic_gmxv1flat.svg";

type ChainIcons = {
  network?: string;
  gmx: string;
  glp: string;
  esgmx?: string;
  gm: string;
  gmxOutline?: string;
  glv?: string;
};

const BASE_CHAIN_ICONS: ChainIcons = {
  network: base,
  gmx: gmxIcon,
  glp: glpIcon,
  esgmx: esGMXIcon,
  gm: gmIcon,
};

const ICONS: Record<number | "common", ChainIcons> = {
  // BASE_MAINNET === SOURCE_BASE_MAINNET (8453) — required or Pools/Stats/Leaderboard crash
  [BASE_MAINNET]: BASE_CHAIN_ICONS,
  [BASE_SEPOLIA]: BASE_CHAIN_ICONS,
  [LOCALHOST]: BASE_CHAIN_ICONS,
  common: {
    gmx: gmxIcon,
    gmxOutline: gmxOutlineIcon,
    glp: glpIcon,
    esgmx: esGMXIcon,
    gm: gmIcon,
    glv: glvIcon,
  },
};

export const CHAIN_ID_TO_NETWORK_ICON: Record<AnyChainId | 0, string> = {
  0: gmxIcon,
  [SOURCE_BASE_MAINNET]: base,
  [BASE_SEPOLIA]: base,
  [LOCALHOST]: base,
};

/**
 * For chain icons use `getChainIcon`
 */
export function getIcon(chainId: number | "common", label: keyof ChainIcons) {
  if (!chainId || !(chainId in ICONS)) {
    throw new Error(`No icons found for chain: ${chainId}`);
  }

  return ICONS[chainId][label];
}

export function getChainIcon(chainId: number): string {
  if (!(chainId in CHAIN_ID_TO_NETWORK_ICON)) {
    throw new Error(`No icon found for chain: ${chainId}`);
  }

  return CHAIN_ID_TO_NETWORK_ICON[chainId];
}

export function getIcons(chainId: number | "common") {
  if (!chainId || !(chainId in ICONS)) {
    throw new Error(`No icons found for chain: ${chainId}`);
  }

  return ICONS[chainId];
}
