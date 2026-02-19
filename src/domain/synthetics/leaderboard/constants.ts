import { expandDecimals } from "lib/numbers";

import { LeaderboardPageConfig, LeaderboardPageKey } from "./types";

export const MIN_COLLATERAL_USD_IN_LEADERBOARD = expandDecimals(500, 30);

export const LEADERBOARD_PAGES_ORDER = ["leaderboard"] as const;

export const LEADERBOARD_PAGES: Record<LeaderboardPageKey, LeaderboardPageConfig> = {
  leaderboard: {
    key: "leaderboard",
    href: "/leaderboard",
    isCompetition: false,
    timeframe: {
      from: 0,
      to: undefined,
    },
  },
};
