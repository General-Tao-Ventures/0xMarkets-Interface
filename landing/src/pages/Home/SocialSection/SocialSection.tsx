import { Trans } from "@lingui/macro";
import { useMemo } from "react";

import { SOCIAL_MAP } from "landing/pages/Home/constants/SociaLinks";

import TradingViewIcon from "img/ic_trading_view.svg?react";

import { SocialBackground } from "./SocialBackground";

export function SocialSection() {
  const links = useMemo(
    () => [
      {
        ...SOCIAL_MAP.Discord,
        value: (
          <a href={SOCIAL_MAP.Discord.link}>
            <Trans>Join</Trans>
          </a>
        ),
      },
      {
        ...SOCIAL_MAP.Twitter,
        value: (
          <a href={SOCIAL_MAP.Twitter.link}>
            <Trans>Follow</Trans>
          </a>
        ),
      },
      {
        ...SOCIAL_MAP.Github,
        value: (
          <a href={SOCIAL_MAP.Github.link}>
            <Trans>View</Trans>
          </a>
        ),
      },
    ],
    []
  );
  return (
    <section className="flex w-full flex-col border-t-0 border-slate-600 bg-slate-900 pt-0 text-white sm:border-t-1/2 sm:pt-[120px]">
      <div className="relative flex w-full overflow-clip px-16 pt-[120px] sm:px-40">
        <SocialBackground />
        <div className="relative mx-auto flex w-full flex-col gap-36 sm:w-[1200px]">
          <h2 className="text-heading-1">
            <Trans>
              Driven by <br /> our community
            </Trans>
          </h2>
          <div className="flex w-full flex-col-reverse items-center justify-between gap-36 border-t-1/2 border-slate-600 md:flex-row">
            <div className="flex flex-row flex-wrap gap-20 sm:gap-36">
              {links.map((link) => (
                <div
                  key={link.name}
                  onClick={link.onClick}
                  className="group flex cursor-pointer flex-col justify-center gap-4 py-0 sm:py-28"
                >
                  <div className="leading-body-sm duration-180 flex w-full flex-row gap-4 text-14 -tracking-[0.448px] text-slate-500 transition-colors group-hover:text-blue-300">
                    <link.IconComponent className="size-20" />
                    <span className="duration-180 transition-transform group-hover:translate-x-4">{link.name}</span>
                  </div>
                  <div className="leading-heading-md text-[40px] font-medium -tracking-[1.2px]">{link.value}</div>
                </div>
              ))}
            </div>

          </div>
          <div className="flex w-full flex-row flex-wrap items-center gap-12 py-20 text-12 font-medium tracking-[0.024px] text-slate-500">
            <a
              href="/#/referral-terms"
              target="_blank"
              rel="noopener noreferrer"
              className="duration-180 transition-colors hover:text-white active:text-white/80"
            >
              <Trans>Referral Terms</Trans>
            </a>
            <a
              href="https://docs.0xmarkets.io/media-kit"
              target="_blank"
              rel="noopener noreferrer"
              className="duration-180 transition-colors hover:text-white active:text-white/80"
            >
              <Trans>Media Kit</Trans>
            </a>
            <a className="inline sm:hidden" href="/#/terms-and-conditions" target="_blank" rel="noopener noreferrer">
              <Trans>Terms and Conditions</Trans>
            </a>
            <div className="mx-0 flex flex-row items-center gap-8 text-white sm:mx-auto">
              <TradingViewIcon className="size-20" />
              <span>Charts by TradingView</span>
            </div>
            <a
              className="duration-180 hidden transition-colors hover:text-white active:text-white/80 sm:inline"
              href="/#/terms-and-conditions"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Trans>Terms and Conditions</Trans>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
