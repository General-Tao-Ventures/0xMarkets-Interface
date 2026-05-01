import useSWR from "swr";

const CARTHA_LP_STATS_URL = "https://api.cartha.finance/v1/lp-stats";

export type CarthaApyTier = {
  lock_days: number;
  boost: number;
  apy_weekly_pct: number;
  apy_annual_pct: number;
};

export type CarthaLpStats = {
  apy_tiers: CarthaApyTier[];
  max_apy: CarthaApyTier;
  tvl: {
    current_usd: number;
    upcoming_usd: number;
    boosted_usd: number;
    excluded_hotkey?: string;
  };
  weekly_rewards: {
    daily_alpha: number;
    weekly_alpha: number;
    weekly_tao: number;
    weekly_usd: number;
  };
  emissions: {
    daily_alpha: number;
    weekly_alpha: number;
    weekly_tao: number;
    weekly_usd: number;
  };
  prices: {
    tao_usd: number;
    alpha_tao: number;
    alpha_usd: number;
    source: string;
    cache_age_seconds: number;
  };
  epoch: {
    current_version: string;
    upcoming_version: string;
    current_start: string;
    current_end: string;
    upcoming_start: string;
  };
  extras: {
    total_positions_current: number;
    total_positions_upcoming: number;
    total_miners_current: number;
    total_miners_upcoming: number;
    max_lock_days: number;
    miner_pool_share: number;
    trader_pool_weight: number;
    token_decimals: number;
  };
  last_updated: string;
};

export function useCarthaLpStats() {
  return useSWR<CarthaLpStats>("cartha-lp-stats", {
    fetcher: async () => {
      const res = await fetch(CARTHA_LP_STATS_URL);
      if (!res.ok) throw new Error(`cartha lp-stats: ${res.status}`);
      return res.json();
    },
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });
}
