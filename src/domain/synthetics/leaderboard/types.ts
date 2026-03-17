import type { ContractsChainId } from "sdk/configs/chains";

import { LEADERBOARD_PAGES_ORDER } from "./constants";

export enum PerfPeriod {
  DAY = "24 hours",
  WEEK = "7 days",
  MONTH = "1 month",
  TOTAL = "All time",
}

export type RemoteData<T> = {
  isLoading: boolean;
  data: T[];
  error: Error | null;
  updatedAt: number;
};

export type CompetitionType = "notionalPnl" | "pnlPercentage";

export type LeaderboardTimeframe = {
  from: number;
  to: number | undefined;
};

export type LeaderboardTimeframeType = "all" | "30days" | "7days";
export type LeaderboardDataType = "accounts" | "positions";

export type LeaderboardPageKey = (typeof LEADERBOARD_PAGES_ORDER)[number];

export type LeaderboardPageConfig =
  | {
      key: LeaderboardPageKey;
      href: string;
      isCompetition: false;
      isTestnet?: false;
      timeframe: LeaderboardTimeframe;
    }
  | {
      key: LeaderboardPageKey;
      href: string;
      isCompetition: true;
      isTestnet?: false;
      chainId: ContractsChainId;
      enabled: boolean;
      timeframe: LeaderboardTimeframe;
    }
  | {
      key: LeaderboardPageKey;
      href: string;
      isCompetition: true;
      isTestnet: true;
      chainId: ContractsChainId;
      enabled: boolean;
      timeframe: LeaderboardTimeframe;
      title: string;
      description: string;
      prizePool: string;
      network: string;
      faucetUrl: string;
      rulesUrl?: string;
    };
