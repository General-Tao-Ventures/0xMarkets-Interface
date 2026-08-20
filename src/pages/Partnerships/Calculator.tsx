import { Trans, t } from "@lingui/macro";
import cx from "classnames";
import { useMemo, useState } from "react";

import { Card, SectionTitle } from "./components";
import { BLENDED_FEE_RATE, EARNED_RUNGS, LADDER, compactUsd, money } from "./tierLadder";

// Stops a partner recognises, not a linear sweep — the interesting decisions all happen below $20m.
const STEPS = [
  250_000, 1_000_000, 3_000_000, 5_000_000, 8_000_000, 12_000_000, 20_000_000, 30_000_000, 50_000_000, 75_000_000,
  100_000_000, 150_000_000, 200_000_000, 300_000_000,
];

/**
 * What a book is worth here.
 *
 * The slider can show what a Kingmaker book would pay, but the two governance rungs are always
 * labelled "by agreement" — reaching their indicative volume is a conversation, not a promotion.
 */
export function Calculator() {
  const [step, setStep] = useState(4);
  const volume = STEPS[step];

  const { fees, reachedIndex, tier, pay } = useMemo(() => {
    const feesGenerated = volume * BLENDED_FEE_RATE;
    let reached = 0;
    LADDER.forEach((rung, i) => {
      const bar = rung.earned ? rung.volumeUsd : rung.indicativeVolumeUsd;
      if (!bar || volume >= bar) reached = i;
    });
    const rung = LADDER[reached];
    return { fees: feesGenerated, reachedIndex: reached, tier: rung, pay: (feesGenerated * rung.ratePct) / 100 };
  }, [volume]);

  return (
    <div className="grid grid-cols-1 gap-16 lg:grid-cols-[1fr_1.15fr]">
      <Card>
        <div className="text-12 text-slate-100">
          <Trans>Monthly volume you introduce</Trans>
        </div>
        <div className="text-34 mt-4 font-medium tabular-nums">{compactUsd(volume)}</div>

        <input
          className="mt-16 w-full accent-blue-300"
          type="range"
          min={0}
          max={STEPS.length - 1}
          step={1}
          value={step}
          aria-label={t`Monthly introduced volume`}
          onChange={(e) => setStep(Number(e.target.value))}
        />
        <div className="flex justify-between text-11 text-slate-100">
          <span>{compactUsd(STEPS[0])}</span>
          <span>{compactUsd(STEPS[STEPS.length - 1])}</span>
        </div>

        <dl className="mt-20 text-13">
          <Readout label={t`Trading fees generated`} value={money(fees)} />
          <Readout
            label={t`Tier this volume reaches`}
            value={`${tier.name} · ${tier.ratePct}%${tier.earned ? "" : t` — by agreement`}`}
          />
          <Readout label={t`Your monthly commission`} value={`${money(pay)} / mo`} accent />
          <Readout label={t`Per $1m introduced`} value={money(pay / (volume / 1e6))} />
          <Readout label={t`Annualised`} value={money(pay * 12)} />
        </dl>

        <div className="mt-16 rounded-4 bg-slate-700/50 p-12 text-12 text-slate-100">
          {!tier.earned ? (
            <Trans>
              <b className="text-white">{tier.name} is agreed case by case</b> at this scale — reach out on Discord.
            </Trans>
          ) : tier.referrals ? (
            <Trans>
              {tier.name} needs this volume <b className="text-white">and {tier.referrals} funded referrals</b>. Both.
            </Trans>
          ) : (
            <Trans>
              <b className="text-white">Everyone starts at Operator on 20%.</b> Tactician needs{" "}
              {compactUsd(EARNED_RUNGS[1].volumeUsd!)} and {EARNED_RUNGS[1].referrals} funded referrals.
            </Trans>
          )}
        </div>
      </Card>

      <Card className="p-0">
        <div className="p-16">
          <SectionTitle sub={t`At ${compactUsd(volume)} a month`}>
            <Trans>Your commission at each tier</Trans>
          </SectionTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-13">
            <thead>
              <tr className="text-left text-12 text-slate-100">
                <th className="px-16 py-8 font-normal">
                  <Trans>Tier</Trans>
                </th>
                <th className="px-12 py-8 text-right font-normal">
                  <Trans>Rate</Trans>
                </th>
                <th className="px-12 py-8 font-normal">
                  <Trans>Requires</Trans>
                </th>
                <th className="px-16 py-8 text-right font-normal">
                  <Trans>You'd earn</Trans>
                </th>
              </tr>
            </thead>
            <tbody>
              {LADDER.map((rung, i) => {
                const lit = i === reachedIndex;
                const withinReach = !rung.volumeUsd || volume >= rung.volumeUsd;
                return (
                  <tr
                    key={rung.name}
                    className={cx("border-t border-slate-700", lit && "bg-slate-700/40", !rung.earned && "opacity-70")}
                  >
                    <td className="px-16 py-10">{rung.name}</td>
                    <td className="px-12 py-10 text-right tabular-nums">{rung.ratePct}%</td>
                    <td className="px-12 py-10 text-12 text-slate-100">
                      {!rung.earned ? (
                        <Trans>{compactUsd(rung.indicativeVolumeUsd!)}+ — by agreement</Trans>
                      ) : rung.volumeUsd ? (
                        <Trans>
                          {compactUsd(rung.volumeUsd)} + {rung.referrals} referrals
                        </Trans>
                      ) : (
                        <Trans>On sign-up</Trans>
                      )}
                    </td>
                    <td
                      className={cx(
                        "px-16 py-10 text-right tabular-nums",
                        lit && "font-medium text-blue-300",
                        rung.earned && !withinReach && "text-slate-100 opacity-60"
                      )}
                    >
                      {money((fees * rung.ratePct) / 100)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Readout({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-slate-700 py-8 last:border-0">
      <dt className="text-slate-100">{label}</dt>
      <dd className={cx("tabular-nums", accent && "font-medium text-blue-300")}>{value}</dd>
    </div>
  );
}
