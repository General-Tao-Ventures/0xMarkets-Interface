import random from "lodash/random";

import { isLocal } from "config/env";
import { Bar, FromNewToOldArray } from "domain/tradingview/types";
import { getOracleKeeperFallbackUrls, getOracleKeeperUrl } from "sdk/configs/oracleKeeper";
import { buildUrl } from "sdk/utils/buildUrl";

import {
  ApyInfo,
  ApyPeriod,
  BatchReportBody,
  DayPriceCandle,
  OracleFetcher,
  PerformanceAnnualizedResponse,
  PerformancePeriod,
  PerformanceSnapshotsResponse,
  RawIncentivesStats,
  TickersResponse,
  UserFeedbackBody,
} from "./types";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

function parseOracleCandle(rawCandle: number[]): Bar {
  const [time, open, high, low, close] = rawCandle;

  return {
    time,
    open,
    high,
    low,
    close,
  };
}

const failsPerMinuteToFallback = 5;

export class OracleKeeperFetcher implements OracleFetcher {
  private readonly chainId: number;

  private readonly forceIncentivesActive: boolean;
  private isFallback: boolean;
  private fallbackUrls: string[];
  private fallbackThrottleTimerId: number | undefined;
  private fallbackIndex: number;
  private failTimes: number[];
  private mainUrl: string;

  constructor(p: { chainId: number; forceIncentivesActive: boolean }) {
    this.chainId = p.chainId;
    this.fallbackUrls = getOracleKeeperFallbackUrls(this.chainId);
    this.mainUrl = getOracleKeeperUrl(this.chainId);
    this.forceIncentivesActive = p.forceIncentivesActive;
    this.isFallback = false;
    this.failTimes = [];
  }

  get url() {
    return this.isFallback ? this.fallbackUrls[this.fallbackIndex] : this.mainUrl;
  }

  handleFailure() {
    if (this.fallbackThrottleTimerId) {
      return;
    }

    this.failTimes.push(Date.now());

    this.failTimes = this.failTimes.filter((time) => time > Date.now() - 60000);

    if (this.failTimes.length >= failsPerMinuteToFallback) {
      if (this.isFallback) {
        this.fallbackIndex = (this.fallbackIndex + 1) % this.fallbackUrls.length;
      } else {
        this.fallbackIndex = random(0, this.fallbackUrls.length - 1);
      }

      this.isFallback = true;
      this.failTimes = [];
    }

    this.fallbackThrottleTimerId = window.setTimeout(() => {
      this.fallbackThrottleTimerId = undefined;
    }, 5000);
  }

  fetchTickers(): Promise<TickersResponse> {
    return fetchJson<TickersResponse>(buildUrl(this.url!, "/prices/tickers"))
      .then((res) => {
        if (!res.length) {
          throw new Error("Invalid tickers response");
        }

        return res;
      })
      .catch((e) => {
        this.handleFailure();

        throw e;
      });
  }

  fetch24hPrices(): Promise<DayPriceCandle[]> {
    return fetchJson<DayPriceCandle[]>(buildUrl(this.url!, "/prices/24h"))
      .then((res) => {
        if (!res?.length) {
          throw new Error("Invalid 24h prices response");
        }

        return res;
      })
      .catch((e) => {
        this.handleFailure();
        throw e;
      });
  }

  fetchPostBatchReport(body: BatchReportBody, debug?: boolean): Promise<Response> {
    if (debug) {
      // eslint-disable-next-line no-console
      console.log("sendBatchMetrics", body);
    }

    if (isLocal()) {
      return Promise.resolve(new Response());
    }

    return fetch(buildUrl(this.url!, "/report/ui/batch_report"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }).catch(() => new Response());
  }

  fetchPostFeedback(body: UserFeedbackBody, debug): Promise<Response> {
    if (debug) {
      // eslint-disable-next-line no-console
      console.log("sendFeedback", body);
    }

    return fetch(buildUrl(this.url!, "/report/ui/feedback"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }).catch(() => new Response());
  }

  fetchApys(period: ApyPeriod): Promise<ApyInfo> {
    return fetchJson<ApyInfo>(buildUrl(this.url!, "/apy", { period }))
      .catch((e) => {
        this.handleFailure();
        throw e;
      });
  }

  async fetchOracleCandles(
    tokenSymbol: string,
    period: string,
    limit: number,
    opts?: { from?: number; to?: number }
  ): Promise<FromNewToOldArray<Bar>> {
    return fetchJson<{ candles: number[][] }>(
      buildUrl(this.url!, "/prices/candles", {
        tokenSymbol,
        period,
        limit,
        from: opts?.from,
        to: opts?.to,
      })
    )
      .then((res) => {
        if (!Array.isArray(res.candles) || (res.candles.length === 0 && limit > 0)) {
          throw new Error("Invalid candles response");
        }

        return res.candles.map(parseOracleCandle);
      })
      .catch((e) => {
        this.handleFailure();
        throw e;
      });
  }

  async fetchIncentivesRewards(): Promise<RawIncentivesStats | null> {
    return fetchJson<RawIncentivesStats>(
      buildUrl(this.url!, "/incentives", {
        ignoreStartDate: this.forceIncentivesActive ? "1" : undefined,
      })
    ).catch(() => {
      this.handleFailure();
      return null;
    });
  }

  async fetchUiVersion(currentVersion: number, active: boolean): Promise<number> {
    return fetchJson<{ version: number }>(
      buildUrl(this.url!, `/ui/min_version?client_version=${currentVersion}&active=${active}`)
    ).then((res) => res.version);
  }

  fetchPerformanceAnnualized(period: PerformancePeriod, address?: string): Promise<PerformanceAnnualizedResponse> {
    return fetchJson<PerformanceAnnualizedResponse>(
      buildUrl(this.url!, "/performance/annualized", { period, address })
    ).catch((e) => {
      this.handleFailure();
      throw e;
    });
  }

  fetchPerformanceSnapshots(period: PerformancePeriod, address?: string): Promise<PerformanceSnapshotsResponse> {
    return fetchJson<PerformanceSnapshotsResponse>(
      buildUrl(this.url!, "/performance/snapshots", { period, address })
    ).catch((e) => {
      this.handleFailure();
      throw e;
    });
  }
}
