import type { Market, MarketInfo } from "./markets";
import type { TokenData } from "./tokens";

export type Position = {
  key: string;
  contractKey: string;
  account: string;
  marketAddress: string;
  collateralTokenAddress: string;
  sizeInUsd: bigint;
  sizeInTokens: bigint;
  collateralAmount: bigint;
  pendingBorrowingFeesUsd: bigint;
  increasedAtTime: bigint;
  decreasedAtTime: bigint;
  isLong: boolean;
  fundingFeeAmount: bigint;
  claimableLongTokenAmount: bigint;
  claimableShortTokenAmount: bigint;
  isOpening?: boolean;
  pnl: bigint;
  positionFeeAmount: bigint;
  traderDiscountAmount: bigint;
  uiFeeAmount: bigint;
  /**
   * pendingImpactAmount is not available on-chain in the 0xMarkets contract struct
   * (removed from the GMX V2 fork). Always defaults to 0n at construction sites:
   *   - sdk/src/modules/positions/positions.ts (numbers.pendingImpactAmount ?? 0n)
   *   - src/domain/synthetics/positions/usePositions.ts (numbers.pendingImpactAmount ?? 0n)
   *
   * Used in calculations:
   *   - sdk/src/utils/positions.ts getLiquidationPrice() — adds to priceImpactDeltaUsd
   *   - sdk/src/utils/fees/priceImpact.ts getProportionalPendingImpactValues() — proportional scaling
   *   - src/domain/synthetics/positions/utils.ts getPositionNetValue() — adds to priceImpactDeltaUsd
   *   - sdk/src/utils/trade/decrease.ts, increase.ts — passed through to liquidation calc
   *
   * With 0n default, these calculations produce correct results (no impact adjustment).
   * If the contract adds this field in the future, remove the ?? 0n fallbacks to use real values.
   */
  pendingImpactAmount: bigint;
  /**
   * Not implemented in parsing
   */
  borrowingFactor?: bigint;
  /**
   * Not implemented in parsing
   */
  fundingFeeAmountPerSize?: bigint;
  /**
   * Not implemented in parsing
   */
  longTokenClaimableFundingAmountPerSize?: bigint;
  /**
   * Not implemented in parsing
   */
  shortTokenClaimableFundingAmountPerSize?: bigint;
  data: string;
};

export type PositionInfo = Position & {
  marketInfo: MarketInfo | undefined;
  market: Market;
  indexToken: TokenData;
  longToken: TokenData;
  shortToken: TokenData;
  indexName: string;
  poolName: string;
  collateralToken: TokenData;
  pnlToken: TokenData;
  markPrice: bigint;
  entryPrice: bigint | undefined;
  liquidationPrice: bigint | undefined;
  collateralUsd: bigint;
  remainingCollateralUsd: bigint;
  remainingCollateralAmount: bigint;
  hasLowCollateral: boolean;
  pnl: bigint;
  pnlPercentage: bigint;
  pnlAfterFees: bigint;
  pnlAfterFeesPercentage: bigint;
  netPriceImapctDeltaUsd: bigint;
  priceImpactDiffUsd: bigint;
  pendingImpactUsd: bigint;
  closePriceImpactDeltaUsd: bigint;
  leverage: bigint | undefined;
  leverageWithPnl: bigint | undefined;
  netValue: bigint;
  closingFeeUsd: bigint;
  uiFeeUsd: bigint;
  pendingFundingFeesUsd: bigint;
  pendingClaimableFundingFeesUsd: bigint;
};

export type PositionInfoLoaded = PositionInfo & { marketInfo: MarketInfo };

export type PositionsData = {
  [positionKey: string]: Position;
};

export type PositionsInfoData = {
  [positionKey: string]: PositionInfo;
};
