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

export default function CarthaLpCard() {
  const { data, isLoading, error } = useCarthaLpStats();

  if (error) {
    return null;
  }

  return (
    <div className="rounded-8 border border-slate-800 bg-slate-750">
      <div className="flex flex-wrap items-end justify-between gap-16 border-b-1/2 border-slate-800 p-16">
        <div className="flex flex-col gap-4">
          <span className="text-body-small font-medium uppercase tracking-wide text-typography-secondary">
            <Trans>Cartha LP</Trans>
          </span>
          <span className="text-h2 font-medium normal-nums">
            {data ? formatPct(data.max_apy.apy_annual_pct) : "—"}
            <span className="ml-8 text-body-medium text-typography-secondary">
              <Trans>max APY (365d lock)</Trans>
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-x-32 gap-y-12">
          <Stat
            label={<Trans>TVL</Trans>}
            value={data ? usdFormatter.format(data.tvl.current_usd) : "—"}
            subValue={
              data ? <Trans>{usdFormatter.format(data.tvl.boosted_usd)} boosted</Trans> : null
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
            label={<Trans>Positions</Trans>}
            value={data ? compactNumberFormatter.format(data.extras.total_positions_current) : "—"}
            subValue={
              data ? (
                <Trans>{compactNumberFormatter.format(data.extras.total_miners_current)} miners</Trans>
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
        {tier ? <Trans>{tier.lock_days}d lock</Trans> : <Trans>—</Trans>}
      </span>
      <span className="text-body-large font-medium normal-nums">
        {tier ? formatPct(tier.apy_annual_pct) : "—"}
      </span>
      <span className="text-body-small text-typography-secondary normal-nums">
        {tier ? <Trans>{formatPct(tier.apy_weekly_pct)} / week</Trans> : null}
      </span>
    </div>
  );
}
