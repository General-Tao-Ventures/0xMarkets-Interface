import useSWR from "swr";

import { USD_DECIMALS } from "config/factors";
import { expandDecimals } from "lib/numbers";

const CARTHA_API = "https://api.cartha.finance";
/** Same public validator hotkey used by cartha-lock-ui Dashboard for verified-miners. */
const CARTHA_VALIDATOR_HOTKEY = "5G6X5swaYj3cfJF2dtrMyxn2SGRhYFnvWe63SV8G2wbosAXM";

type CarthaPairPerformance = {
  pair: string;
  vault_address: string;
  gm_market: string;
  pool_id: string;
};

type CarthaVerifiedMiner = {
  pool_id: string;
  amount: number;
  vault_type?: string;
  hotkey?: string;
};

export type CarthaMarketLiquidity = {
  /** LP-locked USDC for this market from Cartha verified-miners (USD with USD_DECIMALS). */
  tvlUsd: bigint;
  tvlUsdNumber: number;
  pair: string;
  poolId: string;
  vaultAddress: string;
};

async function fetchCarthaMarketLiquidity(): Promise<Record<string, CarthaMarketLiquidity>> {
  const [perfRes, minersRes] = await Promise.all([
    fetch(`${CARTHA_API}/v1/pair-performance?period=7d`),
    fetch(
      `${CARTHA_API}/v1/verified-miners?epoch=current&validator_hotkey=${CARTHA_VALIDATOR_HOTKEY}`
    ),
  ]);

  if (!perfRes.ok) {
    throw new Error(`Cartha pair-performance: ${perfRes.status}`);
  }
  if (!minersRes.ok) {
    throw new Error(`Cartha verified-miners: ${minersRes.status}`);
  }

  const perfJson = (await perfRes.json()) as { pairs: CarthaPairPerformance[] };
  const miners = (await minersRes.json()) as CarthaVerifiedMiner[];

  const tvlByPoolId: Record<string, number> = {};
  for (const row of miners) {
    if (row.vault_type === "parent") continue;
    const poolId = row.pool_id?.toLowerCase();
    if (!poolId) continue;
    tvlByPoolId[poolId] = (tvlByPoolId[poolId] ?? 0) + Number(row.amount || 0) / 1e6;
  }

  const byMarket: Record<string, CarthaMarketLiquidity> = {};
  for (const pair of perfJson.pairs ?? []) {
    const market = pair.gm_market?.toLowerCase();
    const poolId = pair.pool_id?.toLowerCase();
    if (!market || !poolId) continue;

    const tvlUsdNumber = tvlByPoolId[poolId] ?? 0;
    // Convert float USD → 30-decimal USD bigint used across the app.
    const tvlUsd = expandDecimals(BigInt(Math.max(0, Math.round(tvlUsdNumber * 1e6))), USD_DECIMALS - 6);

    byMarket[market] = {
      tvlUsd,
      tvlUsdNumber,
      pair: pair.pair,
      poolId,
      vaultAddress: pair.vault_address,
    };
  }

  return byMarket;
}

/** Per-GM-market LP TVL from Cartha (verified-miners + pair-performance mapping). */
export function useCarthaMarketLiquidity() {
  const { data, error, isLoading } = useSWR("cartha-market-liquidity", fetchCarthaMarketLiquidity, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });

  return {
    liquidityByMarket: data,
    error,
    isLoading,
  };
}

export function getCarthaLiquidityForMarket(
  liquidityByMarket: Record<string, CarthaMarketLiquidity> | undefined,
  marketTokenAddress: string | undefined
): CarthaMarketLiquidity | undefined {
  if (!liquidityByMarket || !marketTokenAddress) return undefined;
  return liquidityByMarket[marketTokenAddress.toLowerCase()];
}

/**
 * Available liquidity for one side from Cartha LP TVL:
 * 1) Split TVL 50/50 across long/short
 * 2) Cap each side at 50% of that half (= 25% of total TVL)
 * 3) Subtract that side's open interest
 *
 * Example: $350k TVL → $175k/side → $87.5k cap → available = $87.5k − OI.
 */
export function getCarthaAvailableLiquidityUsd(params: {
  carthaTvlUsd: bigint;
  openInterestUsd: bigint;
}): bigint {
  const { carthaTvlUsd, openInterestUsd } = params;
  const sideShareUsd = carthaTvlUsd / 2n;
  const cappedSideUsd = sideShareUsd / 2n;
  const available = cappedSideUsd - openInterestUsd;
  return available > 0n ? available : 0n;
}

/** Per-side capacity before OI (25% of Cartha LP TVL). */
export function getCarthaSideCapacityUsd(carthaTvlUsd: bigint): bigint {
  return carthaTvlUsd / 4n;
}
