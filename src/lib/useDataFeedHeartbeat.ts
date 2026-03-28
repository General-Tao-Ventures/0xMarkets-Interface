import { useCallback, useEffect, useRef } from "react";

import { CHART_RESET_IDLE_THRESHOLD, DATA_FEED_STALE_TIMEOUT, REFRESH_DEBOUNCE } from "config/ui";
import { getKeeperWebSocketManager } from "lib/keeperWebSocket";

import type { IChartingLibraryWidget } from "../charting_library";

/**
 * Self-healing hook for the TradingView price feed.
 *
 * Two triggers share the same `refreshDataAndChart` action:
 *
 *   D (heartbeat) — fires every 10s while the tab is visible.
 *     If no keeper ticker has arrived in DATA_FEED_STALE_TIMEOUT (60s) the WS
 *     is force-reconnected and the chart requests fresh bars.
 *     Covers 24/7 open charts where the visibility trigger never fires.
 *
 *   B (visibility restore) — fires on `visibilitychange`.
 *     If the tab was hidden for longer than CHART_RESET_IDLE_THRESHOLD (5 min)
 *     the same reconnect + chart reset runs.
 *
 * A REFRESH_DEBOUNCE (3s) guard prevents both triggers from executing
 * simultaneously when the user returns after a long idle (D and B would
 * otherwise both fire within milliseconds of each other).
 */
export function useDataFeedHeartbeat(tvWidgetRef: React.RefObject<IChartingLibraryWidget | null>) {
  const lastTickAtRef = useRef<number>(Date.now());
  const lastRefreshAtRef = useRef<number>(0);
  const hiddenAtRef = useRef<number | null>(null);

  // Track the most recent keeper ticker so D knows whether the feed is alive.
  useEffect(() => {
    const manager = getKeeperWebSocketManager();
    const handler = () => {
      lastTickAtRef.current = Date.now();
    };
    manager.on("ticker", handler);
    return () => manager.off("ticker", handler);
  }, []);

  const refreshDataAndChart = useCallback(() => {
    if (Date.now() - lastRefreshAtRef.current < REFRESH_DEBOUNCE) return;
    lastRefreshAtRef.current = Date.now();

    // Force a clean WS reconnect so new ticker/candle events resume immediately.
    const manager = getKeeperWebSocketManager();
    manager.disconnect();
    manager.connect();

    // Tell TradingView to discard cached bars and re-fetch via getBars().
    // This fills any gap that opened while the connection was down.
    // The internal unsubscribeBars → subscribeBars cycle also clears the
    // stale lastBar held by DataFeed.activeSubscriptions automatically.
    tvWidgetRef.current?.activeChart().resetData();
  }, [tvWidgetRef]);

  // D: heartbeat — poll every 10s, act when the ticker has been silent too long.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastTickAtRef.current > DATA_FEED_STALE_TIMEOUT) {
        refreshDataAndChart();
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [refreshDataAndChart]);

  // B: visibility restore — act when the user comes back after a long absence.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }

      const hiddenDuration = hiddenAtRef.current !== null ? Date.now() - hiddenAtRef.current : 0;
      hiddenAtRef.current = null;

      if (hiddenDuration > CHART_RESET_IDLE_THRESHOLD) {
        refreshDataAndChart();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refreshDataAndChart]);
}
