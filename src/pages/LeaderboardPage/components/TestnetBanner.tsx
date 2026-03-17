import { Trans, t } from "@lingui/macro";
import { useEffect, useMemo, useState } from "react";

import { useLeaderboardPageKey, useLeaderboardTiming } from "context/SyntheticsStateContext/hooks/leaderboardHooks";
import { LEADERBOARD_PAGES } from "domain/synthetics/leaderboard/constants";

export function TestnetBanner() {
  const pageKey = useLeaderboardPageKey();
  const page = LEADERBOARD_PAGES[pageKey];
  const { isEndInFuture, isStartInFuture, timeframe } = useLeaderboardTiming();

  if (!page.isCompetition || !page.isTestnet) return null;

  const { title, description, prizePool, network, faucetUrl, rulesUrl } = page;

  const durationLabel = useMemo(() => {
    const fmt = (ts: number) =>
      new Date(ts * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
    const start = fmt(timeframe.from);
    const end = timeframe.to ? fmt(timeframe.to) : "TBD";
    return `${start} – ${end}`;
  }, [timeframe]);

  const hasEnded = !isEndInFuture && !isStartInFuture;

  return (
    <div className="relative overflow-hidden rounded-8 border border-cold-blue-900 bg-gradient-to-br from-slate-900 via-cold-blue-900 to-slate-900">
      {/* Decorative glows */}
      <div className="pointer-events-none absolute -right-60 -top-80 h-[340px] w-[340px] rounded-full bg-blue-400 opacity-[0.07] blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-[120px] left-[15%] h-[300px] w-[300px] rounded-full bg-[#00D1CD] opacity-[0.04] blur-[100px]" />

      <div className="relative flex items-start justify-between gap-24 p-28 max-md:flex-col">
        {/* Left */}
        <div className="min-w-0 flex-1">
          <div className="mb-12 inline-block rounded-4 border border-blue-400/20 bg-blue-400/10 px-10 py-3 text-caption font-medium uppercase tracking-wider text-blue-300">
            <Trans>Testnet Competition</Trans>
          </div>

          <h3 className="text-h3 mb-8 font-medium text-typography-primary">{title}</h3>
          <p className="text-body-medium mb-18 max-w-[500px] leading-relaxed text-typography-secondary">
            {description}
          </p>

          {/* Meta stats */}
          <div className="mb-18 flex gap-28 max-md:flex-wrap max-md:gap-16">
            <div>
              <div className="text-caption font-medium uppercase tracking-wider text-typography-inactive">
                <Trans>Prize Pool</Trans>
              </div>
              <div className="mt-4 text-body-medium font-medium text-[#00D1CD]">{prizePool}</div>
            </div>
            <div>
              <div className="text-caption font-medium uppercase tracking-wider text-typography-inactive">
                <Trans>Duration</Trans>
              </div>
              <div className="mt-4 text-body-medium font-medium text-typography-secondary">{durationLabel}</div>
            </div>
            <div>
              <div className="text-caption font-medium uppercase tracking-wider text-typography-inactive">
                <Trans>Network</Trans>
              </div>
              <div className="mt-4 text-body-medium font-medium text-typography-secondary">{network}</div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex gap-10 max-md:w-full max-md:flex-col">
            {!hasEnded && (
              <a
                href={faucetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-6 rounded-6 bg-blue-400 px-18 py-8 text-body-medium font-medium text-white transition-colors hover:bg-[#2a3de5]"
              >
                <Trans>Get Testnet Tokens</Trans>
              </a>
            )}
            {rulesUrl && (
              <a
                href={rulesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-6 border border-slate-600 bg-transparent px-18 py-8 text-body-medium font-medium text-typography-secondary transition-colors hover:border-slate-500 hover:text-typography-primary"
              >
                <Trans>View Rules</Trans>
              </a>
            )}
          </div>
        </div>

        {/* Right — Countdown */}
        <div className="flex-shrink-0 text-right max-md:text-left">
          <BannerCountdown
            isStartInFuture={isStartInFuture}
            isEndInFuture={isEndInFuture}
            hasEnded={hasEnded}
            timeframe={timeframe}
          />
        </div>
      </div>
    </div>
  );
}

function BannerCountdown({
  isStartInFuture,
  isEndInFuture,
  hasEnded,
  timeframe,
}: {
  isStartInFuture: boolean;
  isEndInFuture: boolean;
  hasEnded: boolean;
  timeframe: { from: number; to: number | undefined };
}) {
  if (hasEnded) {
    const endDate = timeframe.to
      ? new Date(timeframe.to * 1000).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })
      : "";
    return (
      <div>
        <div className="text-caption font-medium uppercase tracking-wider text-typography-inactive">
          <Trans>Competition Ended</Trans>
        </div>
        {endDate && <div className="mt-4 text-body-medium text-typography-secondary">{endDate}</div>}
      </div>
    );
  }

  const target = isStartInFuture ? timeframe.from : timeframe.to;
  if (!target) return null;

  const label = isStartInFuture ? t`Starts in` : t`Ends in`;

  return (
    <div>
      <div className="text-caption font-medium uppercase tracking-wider text-typography-inactive">{label}</div>
      <CountdownDigits target={target} />
    </div>
  );
}

function CountdownDigits({ target }: { target: number }) {
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, Math.ceil(target - Date.now() / 1000)));

  useEffect(() => {
    setTimeLeft(Math.max(0, Math.ceil(target - Date.now() / 1000)));
    const id = setInterval(() => {
      setTimeLeft(Math.max(0, Math.ceil(target - Date.now() / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  const days = Math.floor(timeLeft / 86400);
  const hours = Math.floor((timeLeft % 86400) / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div>
      <div className="mt-8 text-[3.6rem] font-medium leading-none tracking-wide text-typography-primary"
           style={{ fontVariantNumeric: "tabular-nums" }}>
        {pad(days)}
        <span className="text-slate-600">:</span>
        {pad(hours)}
        <span className="text-slate-600">:</span>
        {pad(minutes)}
        <span className="text-slate-600">:</span>
        {pad(seconds)}
      </div>
      <div className="mt-6 flex justify-end gap-[22px] text-caption font-medium uppercase tracking-wider text-typography-inactive max-md:justify-start">
        <span>days</span>
        <span>hrs</span>
        <span>min</span>
        <span>sec</span>
      </div>
    </div>
  );
}
