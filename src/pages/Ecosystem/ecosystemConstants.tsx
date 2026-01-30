import { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/macro";

import { BASE_SEPOLIA, ContractsChainId } from "config/chains";

type EcosystemPage = {
  title: MessageDescriptor;
  link: string;
  linkLabel: string;
  about: MessageDescriptor;
  chainIds: ContractsChainId[];
};

// TODO: Add 0xMarkets ecosystem pages when available
export const gmxPages: EcosystemPage[] = [
  {
    title: msg`0xMarkets Documentation`,
    link: "https://docs.0xmarkets.io/",
    linkLabel: "docs.0xmarkets.io",
    about: msg`0xMarkets Documentation and Guides`,
    chainIds: [BASE_SEPOLIA],
  },
];

type EcosystemCommunityProject = {
  title: MessageDescriptor;
  link: string;
  linkLabel: string;
  about: MessageDescriptor;
  creatorLabel: string | string[];
  creatorLink: string | string[];
  chainIds: ContractsChainId[];
};

// TODO: Add community projects as they emerge
export const communityProjects: EcosystemCommunityProject[] = [];

type EcosystemDashboardProject = {
  title: MessageDescriptor;
  link: string;
  linkLabel: string;
  about: MessageDescriptor;
  creatorLabel: string;
  creatorLink: string;
  chainIds: ContractsChainId[];
};

// TODO: Add dashboard projects when available
export const dashboardProjects: EcosystemDashboardProject[] = [];

// Generic DeFi integrations that work with any protocol
export const integrations: EcosystemPage[] = [
  {
    title: msg`DeBank`,
    link: "https://debank.com",
    linkLabel: "debank.com",
    about: msg`DeFi Portfolio Tracker`,
    chainIds: [BASE_SEPOLIA],
  },
  {
    title: msg`Defi Llama`,
    link: "https://defillama.com",
    linkLabel: "defillama.com",
    about: msg`Decentralized Finance Dashboard`,
    chainIds: [BASE_SEPOLIA],
  },
];

type EcosystemTelegramGroup = {
  title: MessageDescriptor;
  link: string;
  linkLabel: string;
  about: MessageDescriptor;
};

// TODO: Add 0xMarkets Telegram groups when available
export const telegramGroups: EcosystemTelegramGroup[] = [
  {
    title: msg`0xMarkets`,
    link: "https://t.me/0xMarkets",
    linkLabel: "t.me",
    about: msg`Telegram Group`,
  },
];
