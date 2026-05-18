import {
  AnyChainId,
  SOURCE_BASE_MAINNET,
  BASE_SEPOLIA,
  LOCALHOST,
} from "config/chains";

import gmIcon from "img/gm_icon.svg";
import base from "img/ic_base_24.svg";
import esGMXIcon from "img/ic_esgmx_40.svg";
import glpIcon from "img/ic_glp_40.svg";
import glvIcon from "img/ic_glv_40.svg";

type ChainIcons = {
  network?: string;
  glp: string;
  esgmx?: string;
  gm: string;
  glv?: string;
};

const ICONS: Record<number | "common", ChainIcons> = {
  [BASE_SEPOLIA]: {
    network: base,
    glp: glpIcon,
    esgmx: esGMXIcon,
    gm: gmIcon,
  },
  [LOCALHOST]: {
    network: base,
    glp: glpIcon,
    esgmx: esGMXIcon,
    gm: gmIcon,
  },
  common: {
    glp: glpIcon,
    esgmx: esGMXIcon,
    gm: gmIcon,
    glv: glvIcon,
  },
};

export const CHAIN_ID_TO_NETWORK_ICON: Record<AnyChainId | 0, string> = {
  0: base,
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
