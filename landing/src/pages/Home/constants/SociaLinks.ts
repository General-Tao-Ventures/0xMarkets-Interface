import IconDiscord from "img/social/ic_discord_new.svg?react";
import IconGithub from "img/social/ic_github_new.svg?react";
import IconX from "img/social/ic_x_new.svg?react";

export const SOCIAL_MAP = {
  Discord: {
    link: "https://discord.gg/XtKESzrBvs",
    name: "Discord",
    IconComponent: IconDiscord,
    onClick: () => {
      window.open("https://discord.gg/XtKESzrBvs", "_blank");
    },
  },
  Github: {
    link: "https://github.com/0xMarkets",
    name: "Github",
    IconComponent: IconGithub,
    onClick: () => {
      window.open("https://github.com/0xMarkets", "_blank");
    },
  },
  Twitter: {
    link: "https://x.com/0x_Markets",
    name: "Twitter",
    IconComponent: IconX,
    onClick: () => {
      window.open("https://x.com/0x_Markets", "_blank");
    },
  },
} as const;

export const SOCIAL_LINKS = Object.values(SOCIAL_MAP);
