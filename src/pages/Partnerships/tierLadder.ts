/**
 * The programme ladder from REBATES_SPEC.md.
 *
 * These are TARGET rates for the programme, not what the contract pays today. A partner's live rate
 * comes from ReferralStorage (usePartnerTier); on Base mainnet tier 0 currently pays the affiliate
 * 5% of fees, not the 20% below. The UI must show both and never present a spec rate as the amount
 * someone will actually receive.
 *
 * `earned` rungs are reachable on a partner's own numbers. The last two are agreed case by case, so
 * their thresholds are indicative copy only and are never used as a promotion test.
 */
export type Rung = {
  name: string;
  ratePct: number;
  volumeUsd: number | null;
  referrals: number | null;
  earned: boolean;
  /** Indicative scale at which the conversation happens. Display only. */
  indicativeVolumeUsd?: number;
};

export const LADDER: Rung[] = [
  { name: "Operator", ratePct: 20, volumeUsd: null, referrals: null, earned: true },
  { name: "Tactician", ratePct: 25, volumeUsd: 3_000_000, referrals: 3, earned: true },
  { name: "Strategist", ratePct: 30, volumeUsd: 8_000_000, referrals: 8, earned: true },
  { name: "Mastermind", ratePct: 35, volumeUsd: 20_000_000, referrals: 15, earned: true },
  { name: "Rainmaker", ratePct: 40, volumeUsd: 50_000_000, referrals: 30, earned: true },
  { name: "Kingmaker", ratePct: 50, volumeUsd: null, referrals: null, earned: false, indicativeVolumeUsd: 100_000_000 },
  { name: "Sovereign", ratePct: 60, volumeUsd: null, referrals: null, earned: false, indicativeVolumeUsd: 200_000_000 },
];

export const EARNED_RUNGS = LADDER.filter((r) => r.earned);
export const REACH_OUT = { volume: "$100m+", referrals: "50+", maxRate: 60 };

/** Which rung a partner's own numbers reach. Presentational — promotion is a governance call. */
export function rungForNumbers(volume30dUsd: number, fundedReferrals: number) {
  let index = 0;
  EARNED_RUNGS.forEach((r, i) => {
    if (r.volumeUsd === null || (volume30dUsd >= r.volumeUsd && fundedReferrals >= (r.referrals ?? 0))) {
      index = i;
    }
  });
  return { index, rung: EARNED_RUNGS[index], next: EARNED_RUNGS[index + 1] };
}

export const compactUsd = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}m` : n >= 1e3 ? `$${Math.round(n / 1e3)}k` : `$${n}`;
