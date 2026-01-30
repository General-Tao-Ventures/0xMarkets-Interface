import { t } from "@lingui/macro";
import { ReactNode } from "react";

import DiscordIcon from "img/ic_discord.svg?react";
import GithubIcon from "img/ic_github.svg?react";
import SubstackIcon from "img/ic_substack.svg?react";
import TelegramIcon from "img/ic_telegram.svg?react";
import XIcon from "img/ic_x.svg?react";

type Link = {
  label: ReactNode;
  link: string;
  external?: boolean;
  isAppLink?: boolean;
};

type SocialLink = {
  link: string;
  name: string;
  icon: React.ReactNode;
};

export function getFooterLinks(isHome) {
  const FOOTER_LINKS: { home: Link[]; app: Link[] } = {
    home: [
      { label: t`Terms and Conditions`, link: "/terms-and-conditions" },
      { label: t`Referral Terms`, link: "/referral-terms" },
      { label: t`Media Kit`, link: "https://docs.0xmarkets.io/media-kit", external: true },
    ],
    app: [
      { label: t`Media Kit`, link: "https://docs.0xmarkets.io/media-kit", external: true },
      { label: t`Charts by TradingView`, link: "https://www.tradingview.com/", external: true },
    ],
  };
  return FOOTER_LINKS[isHome ? "home" : "app"];
}

// TODO: Update with 0xMarkets social links
export const SOCIAL_LINKS: SocialLink[] = [
  { link: "https://twitter.com/0xMarkets", name: "Twitter", icon: <XIcon className="size-16" /> },
  { link: "https://github.com/0xMarkets", name: "Github", icon: <GithubIcon className="size-16" /> },
  { link: "https://t.me/0xMarkets", name: "Telegram", icon: <TelegramIcon className="size-16" /> },
  { link: "https://discord.gg/0xMarkets", name: "Discord", icon: <DiscordIcon className="size-16" /> },
];
