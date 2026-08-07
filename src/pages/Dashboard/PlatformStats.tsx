import { Trans, t } from "@lingui/macro";
import { useMemo } from "react";

import { USD_DECIMALS } from "config/factors";
import { useCarthaLpStats } from "domain/cartha/useCarthaLpStats";
import useV2Stats from "domain/synthetics/stats/useV2Stats";
import { useChainId } from "lib/chains";
import { formatAmountHuman } from "lib/numbers";

import { getFormattedFeesDuration } from "./getFormattedFeesDuration";

const poolsTvlFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

/**
 * Large stat cell — hero number with caption label above.
 */
function StatCell({
  label,
  value,
  accent,
  className = "",
}: {
  label: string;
  value: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-caption font-medium uppercase tracking-wider text-typography-secondary">{label}</div>
      <div
        className={`mt-6 text-[2rem] font-medium leading-none tracking-tight ${
          accent ? "text-[#00D1CD]" : "text-typography-primary"
        }`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Fee breakdown row — colored pip + label + right-aligned value.
 */
function FeeRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between py-6">
      <div className="flex items-center gap-8">
        <div className="size-6 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-body-medium text-typography-secondary">{label}</span>
      </div>
      <span className="numbers text-body-medium font-medium text-typography-primary">{value}</span>
    </div>
  );
}

export function PlatformStats() {
  const { chainId } = useChainId();
  const v2Overview = useV2Stats(chainId);
  const { data: carthaLpStats } = useCarthaLpStats();

  const formattedDuration = useMemo(() => getFormattedFeesDuration(), []);

  const fmtUsd = (val: bigint | undefined) => formatAmountHuman(val, USD_DECIMALS, true, 2);
  const fmtPlain = (val: bigint | undefined) => formatAmountHuman(val, 0, false, 0);
  const poolsTvl =
    carthaLpStats?.tvl.current_usd != null ? poolsTvlFormatter.format(carthaLpStats.tvl.current_usd) : "—";

  const weeklyAnnualized = (v2Overview.weeklyFees * 365n) / 7n;

  return (
    <div className="relative overflow-hidden rounded-20 bg-slate-800">
      {/* Decorative ambient glows */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[280px] w-[280px] rounded-full bg-[#00D1CD] opacity-[0.03] blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-60 -right-40 h-[320px] w-[320px] rounded-full bg-blue-400 opacity-[0.04] blur-[100px]" />

      <div className="relative p-28 max-md:p-20">
        {/* Header */}
        <div className="mb-24 flex items-center justify-between">
          <h3 className="text-h3 font-medium text-typography-primary">
            <Trans>Platform Stats</Trans>
          </h3>
          <div className="rounded-4 border border-slate-600 bg-slate-900/60 px-10 py-3 text-caption text-typography-secondary">
            Base Sepolia
          </div>
        </div>

        {/* Hero metrics — 2×3 grid on desktop, stacked on mobile */}
        <div className="grid grid-cols-2 gap-x-32 gap-y-24 md:grid-cols-3">
          <StatCell label={t`Total Fees`} value={fmtUsd(v2Overview.totalFees)} accent />
          <StatCell label={t`Total Volume`} value={fmtUsd(v2Overview.totalVolume)} />
          <StatCell label={t`Open Interest`} value={fmtUsd(v2Overview.openInterest)} />
          <StatCell label={t`24h Volume`} value={fmtUsd(v2Overview.dailyVolume)} />
          <StatCell label={t`Total Users`} value={fmtPlain(v2Overview.totalUsers)} />
          <StatCell label={t`Pools TVL`} value={poolsTvl} />
        </div>

        {/* Divider */}
        <div className="my-24 h-[0.5px] bg-slate-600" />

        {/* Bottom section — fee breakdown + position summary */}
        <div className="grid grid-cols-1 gap-24 md:grid-cols-2">
          {/* Fee Breakdown */}
          <div>
            <div className="mb-12 flex items-center justify-between">
              <span className="text-caption font-medium uppercase tracking-wider text-typography-secondary">
                <Trans>Fee Breakdown</Trans>
              </span>
              <span className="text-caption text-typography-secondary">
                {formattedDuration} epoch
              </span>
            </div>

            <div className="rounded-8 bg-slate-900/60 px-16 py-12">
              <FeeRow label={t`Position Fees`} value={fmtUsd(v2Overview.totalPositionFees)} color="#2D42FC" />
              <FeeRow label={t`Borrowing Fees`} value={fmtUsd(v2Overview.totalBorrowingFees)} color="#7885FF" />
              <FeeRow label={t`Liquidation Fees`} value={fmtUsd(v2Overview.totalLiquidationFees)} color="#FF506A" />

              <div className="mt-8 flex items-center justify-between border-t border-slate-600 pt-8">
                <span className="text-body-medium font-medium text-typography-secondary">
                  <Trans>Total</Trans>
                </span>
                <span className="numbers text-body-medium font-medium text-[#00D1CD]">
                  {fmtUsd(v2Overview.totalFees)}
                </span>
              </div>
            </div>
          </div>

          {/* Position Summary */}
          <div>
            <div className="mb-12">
              <span className="text-caption font-medium uppercase tracking-wider text-typography-secondary">
                <Trans>Position Summary</Trans>
              </span>
            </div>

            <div className="rounded-8 bg-slate-900/60 px-16 py-12">
              <div className="flex items-center justify-between py-6">
                <div className="flex items-center gap-8">
                  <div className="size-6 rounded-full bg-green-500" />
                  <span className="text-body-medium text-typography-secondary">
                    <Trans>Longs</Trans>
                  </span>
                </div>
                <span className="numbers text-body-medium font-medium text-green-500">
                  {fmtUsd(v2Overview.totalLongPositionSizes)}
                </span>
              </div>
              <div className="flex items-center justify-between py-6">
                <div className="flex items-center gap-8">
                  <div className="size-6 rounded-full bg-red-500" />
                  <span className="text-body-medium text-typography-secondary">
                    <Trans>Shorts</Trans>
                  </span>
                </div>
                <span className="numbers text-body-medium font-medium text-red-500">
                  {fmtUsd(v2Overview.totalShortPositionSizes)}
                </span>
              </div>

              {/* Long/Short ratio bar */}
              <LongShortBar
                longSize={v2Overview.totalLongPositionSizes}
                shortSize={v2Overview.totalShortPositionSizes}
              />

              <div className="mt-8 flex items-center justify-between border-t border-slate-600 pt-8">
                <span className="text-body-medium font-medium text-typography-secondary">
                  <Trans>Epoch Fees</Trans>
                </span>
                <span className="numbers text-body-medium font-medium text-[#00D1CD]">
                  {fmtUsd(v2Overview.epochFees)}
                </span>
              </div>

              <div className="flex items-center justify-between py-4">
                <span className="text-body-medium text-typography-secondary">
                  <Trans>Annualized (7d)</Trans>
                </span>
                <span className="numbers text-body-medium text-typography-secondary">
                  {fmtUsd(weeklyAnnualized)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LongShortBar({ longSize, shortSize }: { longSize: bigint; shortSize: bigint }) {
  const total = longSize + shortSize;
  if (total === 0n) return null;

  const longPct = Number((longSize * 1000n) / total) / 10;

  return (
    <div className="mt-10 mb-4">
      <div className="flex h-4 w-full overflow-hidden rounded-full">
        <div className="bg-green-500 transition-all duration-500" style={{ width: `${longPct}%` }} />
        <div className="bg-red-500 flex-1" />
      </div>
      <div className="mt-4 flex justify-between text-caption text-typography-secondary">
        <span>{longPct.toFixed(1)}% Long</span>
        <span>{(100 - longPct).toFixed(1)}% Short</span>
      </div>
    </div>
  );
}
