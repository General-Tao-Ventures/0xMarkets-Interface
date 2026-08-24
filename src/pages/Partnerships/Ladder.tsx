import { Trans } from "@lingui/macro";
import cx from "classnames";

import { LADDER, REACH_OUT, compactUsd } from "./tierLadder";

/**
 * The seven rungs. The partner's own rung is marked YOU; the two governance rungs are greyed and
 * carry the reach-out line rather than a threshold, because they are not earned automatically.
 */
export function Ladder({ currentIndex }: { currentIndex: number }) {
  return (
    <div className="grid grid-cols-2 gap-8 md:grid-cols-4 xl:grid-cols-7">
      {LADDER.map((rung, i) => {
        const isHere = rung.earned && i === currentIndex;
        const isDone = rung.earned && i < currentIndex;
        return (
          <div
            key={rung.name}
            className={cx(
              "relative rounded-4 border p-12",
              !rung.earned && "bg-slate-800/40 border-slate-700 opacity-60",
              rung.earned && !isHere && "border-slate-700 bg-slate-800",
              isHere && "border-blue-300 bg-slate-800"
            )}
          >
            {isHere && (
              <span className="text-10 absolute -top-8 right-8 rounded-full bg-blue-300 px-8 py-2 font-medium text-slate-900">
                <Trans>YOU</Trans>
              </span>
            )}
            <div className="text-11 text-slate-100">{String(i + 1).padStart(2, "0")}</div>
            <div className={cx("mt-4 text-14 font-medium", isDone && "text-slate-100")}>{rung.name}</div>
            <div className={cx("mt-2 text-16 tabular-nums", isHere ? "text-blue-300" : "text-slate-100")}>
              {rung.ratePct}%
            </div>
            <div className="leading-snug mt-6 text-11 text-slate-100">
              {!rung.earned ? (
                <Trans>
                  {compactUsd(rung.indicativeVolumeUsd!)}+ vol · {REACH_OUT.referrals} traders — reach out on Discord
                </Trans>
              ) : rung.volumeUsd ? (
                <>
                  {compactUsd(rung.volumeUsd)} · {rung.referrals} <Trans>referrals</Trans>
                </>
              ) : (
                <Trans>On sign-up</Trans>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
