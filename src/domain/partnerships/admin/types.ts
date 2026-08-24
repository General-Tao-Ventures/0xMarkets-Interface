/** Shapes the admin console works in. All USD figures are plain numbers, not 30-decimal bigints:
 *  the console is a reporting surface and every column is a ratio or a derived total. */

export type AdminPartner = {
  affiliate: string;
  codes: string[];
  tierIndex: number;
  tierName: string;
  rebatePct: number;
  /** Live rate from ReferralStorage, not the programme target. */
  liveAffiliateSharePct: number;
  volume30dUsd: number;
  lifetimeVolumeUsd: number;
  referrals: number;
  fundedReferrals: number;
  feesUsd: number;
  rebatePaidUsd: number;
  lpFeeShareUsd: number;
  /** From the trader's side: positive means the traders won, which is money the pool lost. */
  traderPnlUsd: number;
  lpNetUsd: number;
  pnlPer1mUsd: number;
  pnlPctVolume: number;
  contact?: AdminContact;
};

export type AdminContact = {
  channel: "discord" | "telegram" | "email";
  handle: string;
  verifiedAt: string | null;
  /** The same verified channel sits behind more than one partner address. Review, never a block. */
  shared: boolean;
};

export type TraderFlag = "self" | "winner" | "unavailable-funded";

export type AdminReferral = {
  trader: string;
  affiliate: string;
  referralCode: string;
  joinedAt: number | null;
  isFunded: boolean;
  volumeUsd: number;
  feesPaidUsd: number;
  rebateToPartnerUsd: number;
  traderPnlUsd: number;
  lpFeeShareUsd: number;
  lpNetUsd: number;
  pnlPer1mUsd: number;
  pnlPctVolume: number;
  flags: TraderFlag[];
};

export type SharedContactCluster = {
  channel: string;
  handle: string;
  affiliates: string[];
  combinedVolumeUsd: number;
  traders: number;
  combinedRebateUsd: number;
};

export type RiskFlag = {
  affiliate: string;
  kind: "self-referred" | "toxic-flow";
  detail: string;
  volumeAtRiskUsd: number;
  lpImpactUsd: number;
};
