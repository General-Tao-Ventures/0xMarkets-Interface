/**
 * Partner-programme types.
 *
 * Every USD figure here is 30-decimal, matching the rest of the app. The indexer stores them that
 * way for these entities — note this is NOT true of the older `feesInfo` entity, which is written
 * in collateral-token precision and re-scaled on read in useV2FeesInfo.ts. Do not copy that.
 */

export type AffiliateStat = {
  affiliate: string;
  volumeUsd: bigint;
  tradesCount: number;
  /** Distinct traders who have opened at least one position — the funded-referral count. */
  referredTradersCount: number;
  feesGeneratedUsd: bigint;
  /** The whole slice carved out of the fee: the partner's share plus the trader's discount. */
  totalRebateUsd: bigint;
  /** The partner's share alone — what they are actually paid. */
  affiliateRewardUsd: bigint;
  traderDiscountUsd: bigint;
  firstTradeTimestamp: number;
  lastTradeTimestamp: number;
};

export type PeriodAffiliateStat = {
  periodStart: number;
  volumeUsd: bigint;
  tradesCount: number;
  /** Distinct traders who transacted in the period, not fills. */
  tradersActive: number;
  feesGeneratedUsd: bigint;
  affiliateRewardUsd: bigint;
};

export type ReferredTrader = {
  trader: string;
  /** bytes32, right-padded. Decode with decodeReferralCode for display. */
  referralCode: `0x${string}`;
  /** False when the trader attached a code but has never taken a fee-bearing fill. */
  isFunded: boolean;
  /** When the code was attached. Undefined for rows first seen through a fill. */
  registeredAt?: number;
  /** Undefined until they have actually traded. */
  firstTradeTimestamp?: number;
  lastTradeTimestamp?: number;
  volumeUsd: bigint;
  tradesCount: number;
  feesPaidUsd: bigint;
  rebateGeneratedUsd: bigint;
  /** Joined from AccountStat. Undefined when the trader has no closed positions yet. */
  realizedPnlUsd?: bigint;
};

export type AffiliateRewardEntry = {
  id: string;
  market: string;
  token: string;
  /** Credited when isClaim is false, withdrawn when true. Collateral-token units, not USD. */
  delta: bigint;
  nextValue: bigint;
  isClaim: boolean;
  timestamp: number;
  transactionHash: string;
};

/** A code's worth of activity, folded up from the traders attached to it. */
export type CodeBreakdown = {
  referralCode: `0x${string}`;
  tradersCount: number;
  volumeUsd: bigint;
  feesGeneratedUsd: bigint;
  rebateEarnedUsd: bigint;
};

/**
 * The live tier a partner sits on, read from ReferralStorage rather than any hardcoded ladder.
 * `affiliateShareBps` is what they are actually paid: the contract splits totalRebate between the
 * partner and the trader's discount, so the partner keeps only the non-discount part.
 */
export type PartnerTier = {
  tierLevel: number;
  totalRebateBps: number;
  discountShareBps: number;
  /** totalRebate * (1 - discountShare), in bps of the fee. */
  affiliateShareBps: number;
};
