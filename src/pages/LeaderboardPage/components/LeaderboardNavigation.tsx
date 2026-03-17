import { t } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import cx from "classnames";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { useLeaderboardPageKey } from "context/SyntheticsStateContext/hooks/leaderboardHooks";
import { LeaderboardPageKey, LeaderboardTimeframe } from "domain/synthetics/leaderboard";
import { LEADERBOARD_PAGES, LEADERBOARD_PAGES_ORDER } from "domain/synthetics/leaderboard/constants";
import { getTimeframeLabel } from "lib/dates";
import { mustNeverExist } from "lib/types";

import { BodyScrollFadeContainer } from "components/TableScrollFade/TableScrollFade";

type LeaderboardNavigationItem = {
  key: string;
  label: string;
  chip: "live" | "soon" | "over" | "none";
  isSelected: boolean;
  isCompetition: boolean;
  chainId?: number;
  href: string;
  timeframe: LeaderboardTimeframe;
};

const sortingPoints: Record<LeaderboardNavigationItem["chip"], number> = {
  over: 3,
  soon: 2,
  live: 1,
  none: 0,
};

function getChip(pageKey: LeaderboardPageKey): LeaderboardNavigationItem["chip"] {
  const page = LEADERBOARD_PAGES[pageKey];
  if (!page.isCompetition) return "none";

  const now = Date.now() / 1000;
  const { from, to } = page.timeframe;

  if (from > now) return "soon";
  if (to && to < now) return "over";
  return "live";
}

function getLabel(pageKey: LeaderboardPageKey) {
  switch (pageKey) {
    case "leaderboard":
      return t`Global`;
    case "testnet":
      return t`Testnet`;
    default:
      throw mustNeverExist(pageKey);
  }
}

export function LeaderboardNavigation() {
  const pageKey = useLeaderboardPageKey();
  const navigationItems = useMemo(() => {
    const allItems: LeaderboardNavigationItem[] = LEADERBOARD_PAGES_ORDER.map((key) => LEADERBOARD_PAGES[key])
      .filter((page) => !page.isCompetition || page.enabled)
      .map((page) => {
        return {
          key: page.key,
          label: getLabel(page.key),
          chip: getChip(page.key),
          isSelected: page.key === pageKey,
          isCompetition: page.key !== "leaderboard",
          href: page.href,
          timeframe: page.timeframe,
        };
      });

    const isCurrentPageConcluded = pageKey !== "leaderboard" && getChip(pageKey) === "over";

    let filteredItems = allItems;
    if (isCurrentPageConcluded) {
      // Keep "Global" (non-competition items) visible so users can navigate back
      filteredItems = allItems.filter((item) => item.chip === "over" || !item.isCompetition);
    } else {
      const nonConcludedItems = allItems.filter((item) => item.chip !== "over");
      const concludedItems = allItems.filter((item) => item.chip === "over").toReversed();

      const concludedTab: LeaderboardNavigationItem | null =
        concludedItems.length > 0
          ? {
              key: "concluded",
              label: t`Concluded`,
              chip: "none",
              isSelected: false,
              isCompetition: false,
              href: concludedItems[0].href,
              timeframe: { from: 0, to: undefined },
            }
          : null;

      filteredItems = [...nonConcludedItems];
      if (concludedTab) {
        filteredItems.push(concludedTab);
      }
    }

    // Sort items
    return filteredItems.sort((a, b) => {
      // Special case for "Concluded" tab - always put it last
      if (a.key === "concluded") return 1;
      if (b.key === "concluded") return -1;

      const sortingPointA = sortingPoints[a.chip];
      const sortingPointB = sortingPoints[b.chip];

      if (sortingPointA === sortingPointB) {
        return b.timeframe.from - a.timeframe.from;
      }

      return sortingPointA - sortingPointB;
    });
  }, [pageKey]);

  return (
    <BodyScrollFadeContainer className="flex gap-20">
      {navigationItems.map((item) => (
        <NavigationItem item={item} key={item.key} />
      ))}
    </BodyScrollFadeContainer>
  );
}

function NavigationItem({ item }: { item: LeaderboardNavigationItem }) {
  const { i18n } = useLingui();
  const timeframeLabel = getTimeframeLabel(item.timeframe, i18n.locale);
  return (
    <Link
      to={item.href}
      className={cx(
        "text-h1 inline-flex items-center gap-8 whitespace-nowrap leading-1 text-typography-secondary hover:text-typography-primary",
        {
          "!text-typography-primary": item.isSelected,
          "border-l-1/2 border-l-slate-600 pl-18": item.key === "concluded",
        }
      )}
    >
      {item.label}

      {item.chip === "live" && (
        <div className="inline-flex items-center gap-4 rounded-full bg-[#b42941] px-8 py-4 text-[1.1rem] font-medium uppercase leading-none text-white">
          <span className="inline-block size-[6px] animate-pulse rounded-full bg-white" />
          Live
        </div>
      )}

      {item.chip === "soon" && (
        <div className="inline-flex items-center rounded-full bg-blue-400/20 px-8 py-4 text-[1.1rem] font-medium uppercase leading-none text-blue-300">
          Soon
        </div>
      )}

      {item.chip === "over" && (
        <div className="inline-flex items-center rounded-full bg-slate-700 px-8 py-4 text-[1.1rem] font-medium uppercase leading-none text-typography-inactive">
          Ended
        </div>
      )}

      {timeframeLabel && item.chip === "none" && (
        <div className="text-body-small inline-flex h-fit whitespace-nowrap rounded-full bg-slate-700 px-8 py-6 text-typography-secondary">
          {timeframeLabel}
        </div>
      )}
    </Link>
  );
}
