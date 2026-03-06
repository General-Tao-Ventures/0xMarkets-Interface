import { Trans } from "@lingui/macro";
import cx from "classnames";
import { forwardRef, useMemo } from "react";

import { Token } from "domain/tokens";
import { importImage } from "lib/legacy";
import { calculateDisplayDecimals } from "lib/numbers";
import { formatAmount, formatPercentage, formatUsd } from "lib/numbers";
import { getTokenVisualMultiplier } from "sdk/configs/tokens";

import SpinningLoader from "components/Loader/SpinningLoader";
import TokenIcon from "components/TokenIcon/TokenIcon";

import LogoIcon from "img/logo-icon.svg?react";

type Props = {
  entryPrice: bigint | undefined;
  indexToken: Token;
  isLong: boolean;
  leverage: bigint | undefined;
  loading: boolean;
  markPrice: bigint;
  pnlAfterFeesPercentage: bigint;
  sharePositionBgImg: string | null;
  userAffiliateCode: any;
};

function getTokenIconUrl(symbol: string) {
  return importImage(`ic_${symbol.toLowerCase()}_40.svg`);
}

export const PositionShareCard = forwardRef<HTMLDivElement, Props>(
  (
    {
      entryPrice,
      indexToken,
      isLong,
      leverage,
      loading,
      markPrice,
      pnlAfterFeesPercentage,
      sharePositionBgImg,
      userAffiliateCode,
    },
    ref
  ) => {
    const { code, success } = userAffiliateCode;
    const style = useMemo(() => ({ backgroundImage: `url(${sharePositionBgImg})` }), [sharePositionBgImg]);

    const priceDecimals = calculateDisplayDecimals(markPrice, undefined, indexToken.visualMultiplier);

    return (
      <div className="relative overflow-hidden rounded-9">
        <div
          ref={ref}
          className="relative w-[533px] rounded-9 bg-cover bg-center bg-no-repeat p-32 max-md:w-[400px] max-md:p-24 max-smallMobile:w-full"
          style={{ ...style, aspectRatio: "533 / 300" }}
        >
          {/* Large watermark token icon */}
          <img
            src={getTokenIconUrl(indexToken.symbol)}
            alt=""
            className="pointer-events-none absolute right-[60px] top-[16px] size-[268px] opacity-20 max-md:right-[30px] max-md:size-[200px]"
          />

          {/* Glass circle behind token icon */}
          <div className="pointer-events-none absolute right-[-5px] top-[5px] size-[372px] rounded-full bg-white/[0.01] max-md:right-[-20px] max-md:size-[280px]" />

          {/* Content */}
          <div className="relative z-[3] flex h-full flex-col justify-between">
            {/* Top: Token pair + Long/Short badge */}
            <div className="flex items-center gap-8">
              <TokenIcon symbol={indexToken.symbol} displaySize={16} importSize={24} />
              <span className="text-12 uppercase text-white">
                {getTokenVisualMultiplier(indexToken)}
                {indexToken.symbol}/USD
              </span>
              <span
                className={cx(
                  "rounded-2 px-4 py-2 text-14 font-medium uppercase",
                  isLong ? "bg-green-500 text-slate-900" : "bg-red-500 text-white"
                )}
              >
                {isLong ? "LONG" : "SHORT"} {formatAmount(leverage, 4, 2, true)}x
              </span>
            </div>

            {/* PnL percentage */}
            <h3
              className={cx(
                "text-[56px] font-normal uppercase leading-none max-md:text-[44px]",
                pnlAfterFeesPercentage < 0 ? "text-red-500" : "text-green-500"
              )}
            >
              {formatPercentage(pnlAfterFeesPercentage, { signed: true })}
            </h3>

            {/* Prices */}
            <div className="flex flex-col gap-12">
              <div className="flex gap-24 text-12 max-md:gap-16">
                <div className="flex flex-col gap-8">
                  <p className="text-gray-400">Entry Price</p>
                  <p className="text-white">
                    {formatUsd(entryPrice, {
                      displayDecimals: priceDecimals,
                      visualMultiplier: indexToken.visualMultiplier,
                    })}
                  </p>
                </div>
                <div className="flex flex-col gap-8">
                  <p className="text-gray-400">Mark Price</p>
                  <p className="text-white">
                    {formatUsd(markPrice, {
                      displayDecimals: priceDecimals,
                      visualMultiplier: indexToken.visualMultiplier,
                    })}
                  </p>
                </div>
              </div>

              {success && code ? (
                <div className="flex flex-col gap-8 text-12">
                  <p className="text-gray-400">Referral Code:</p>
                  <p className="text-white">0xMarkets.io/{code}</p>
                </div>
              ) : null}
            </div>
          </div>

          {/* 0xMarkets logo bottom-right */}
          <div className="absolute bottom-16 right-16 z-[3] flex items-center gap-8">
            <LogoIcon className="size-[30px]" />
            <span className="text-14 font-medium text-white">0xMarkets</span>
          </div>
        </div>
        {loading && (
          <div className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2 items-center gap-8 bg-slate-800/90 px-8 py-6">
            <SpinningLoader />
            <p className="loading-text">
              <Trans>Generating shareable image...</Trans>
            </p>
          </div>
        )}
      </div>
    );
  }
);
