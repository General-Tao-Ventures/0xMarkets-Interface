import { Trans } from "@lingui/macro";
import cx from "classnames";

import { useCarthaLpStats, type CarthaApyTier } from "domain/cartha/useCarthaLpStats";

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const pctFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 2,
});

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatPct(value: number): string {
  return pctFormatter.format(value / 100);
}

function formatCountdown(targetIso: string, nowMs: number): string {
  const target = new Date(targetIso).getTime();
  const ms = target - nowMs;
  if (ms <= 0) return "now";
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatRelative(targetIso: string, nowMs: number): string {
  const target = new Date(targetIso).getTime();
  const seconds = Math.max(0, Math.floor((nowMs - target) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/** Cartha LP stats card. */
export default function CarthaLpCard() {
  const { data, isLoading, error } = useCarthaLpStats();

  if (error) {
    return null;
  }

  const now = Date.now();

  return (
    <div className="rounded-8 border border-slate-800 bg-slate-750">
      <div className="flex flex-wrap items-end justify-between gap-16 border-b-1/2 border-slate-800 p-16">
        <div className="flex flex-col gap-4">
          <span className="text-body-small font-medium uppercase tracking-wide text-typography-secondary">
            <Trans>Cartha LP</Trans>
          </span>
          <span className="text-h2 font-medium normal-nums">
            <Trans>Earn up to</Trans>{" "}
            <span className="text-blue-300">{data ? formatPct(data.max_apy.apy_annual_pct) : "—"}</span>{" "}
            <Trans>APY</Trans>
            <span className="ml-8 text-body-medium text-typography-secondary">
              {data ? <Trans>with a {data.max_apy.lock_days}-day lock</Trans> : null}
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-x-32 gap-y-12">
          <Stat
            label={<Trans>TVL</Trans>}
            value={data ? usdFormatter.format(data.tvl.current_usd) : "—"}
            subValue={
              data ? <Trans>{usdFormatter.format(data.tvl.upcoming_usd)} next epoch</Trans> : null
            }
          />
          <Stat
            label={<Trans>Weekly rewards</Trans>}
            value={data ? usdFormatter.format(data.weekly_rewards.weekly_usd) : "—"}
            subValue={
              data ? (
                <Trans>{compactNumberFormatter.format(data.weekly_rewards.weekly_alpha)} α</Trans>
              ) : null
            }
          />
          <Stat
            label={<Trans>Liquidity providers</Trans>}
            value={data ? compactNumberFormatter.format(data.extras.total_miners_current) : "—"}
            subValue={
              data ? (
                <Trans>
                  {compactNumberFormatter.format(data.extras.total_positions_current)} positions
                </Trans>
              ) : null
            }
          />
        </div>
      </div>

      <div className="p-16">
        <div className="mb-12 text-body-small font-medium uppercase tracking-wide text-typography-secondary">
          <Trans>APY by lock period</Trans>
        </div>
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {data?.apy_tiers.map((tier) => (
            <ApyTierCell key={tier.lock_days} tier={tier} isMax={tier.lock_days === data.max_apy.lock_days} />
          ))}
          {!data && isLoading
            ? Array.from({ length: 4 }).map((_, i) => <ApyTierCell key={i} />)
            : null}
        </div>
      </div>

      {data ? (
        <div className="flex flex-wrap items-center justify-between gap-8 border-t-1/2 border-slate-800 px-16 py-10 text-body-small text-typography-secondary">
          <span>
            <Trans>Next epoch in {formatCountdown(data.epoch.upcoming_start, now)}</Trans>
          </span>
          <span>
            <Trans>Updated {formatRelative(data.last_updated, now)}</Trans>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  subValue,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  subValue?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-body-small font-medium uppercase tracking-wide text-typography-secondary">{label}</span>
      <span className="text-body-large font-medium normal-nums">{value}</span>
      {subValue ? <span className="text-body-small text-typography-secondary normal-nums">{subValue}</span> : null}
    </div>
  );
}

function ApyTierCell({ tier, isMax }: { tier?: CarthaApyTier; isMax?: boolean }) {
  return (
    <div
      className={cx("flex flex-col gap-4 rounded-8 border p-12", {
        "border-slate-800 bg-slate-800/40": !isMax,
        "border-blue-300/40 bg-blue-300/10": isMax,
      })}
    >
      <span className="text-body-small font-medium uppercase tracking-wide text-typography-secondary">
        {tier ? `${tier.lock_days}d lock` : "—"}
      </span>
      <span className="text-body-large font-medium normal-nums">
        {tier ? formatPct(tier.apy_annual_pct) : "—"}
      </span>
      <span className="text-body-small text-typography-secondary normal-nums">
        {tier ? `${formatPct(tier.apy_weekly_pct)} / week` : null}
      </span>
    </div>
  );
}
