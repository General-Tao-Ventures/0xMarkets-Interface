import cx from "classnames";
import { ReactNode } from "react";

import { formatUsd } from "lib/numbers";

export function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-4 bg-slate-800 p-16">
      <div className="text-12 text-slate-100">{label}</div>
      <div className="mt-4 text-24 font-medium tabular-nums">{value}</div>
      {sub ? <div className="mt-4 text-12 text-slate-100">{sub}</div> : null}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-4 bg-slate-800 p-16", className)}>{children}</div>;
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-16">
      <h2 className="text-16 font-medium">{children}</h2>
      {sub ? <div className="mt-4 text-12 text-slate-100">{sub}</div> : null}
    </div>
  );
}

/** Horizontal progress bar, clamped so an over-target value still renders sanely. */
export function Progress({ value, target }: { value: bigint; target: bigint }) {
  const pct = target > 0n ? Number((value * 100n) / target) : 0;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="mt-8 h-6 w-full overflow-hidden rounded-full bg-slate-700">
      <div className="h-full rounded-full bg-blue-300" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-24 text-center text-13 text-slate-100">
        {children}
      </td>
    </tr>
  );
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-13">
        <thead>
          <tr className="text-left text-12 text-slate-100">
            {head.map((h, i) => (
              <th key={i} className={cx("px-12 py-8 font-normal", i > 0 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, right, className }: { children: ReactNode; right?: boolean; className?: string }) {
  return <td className={cx("px-12 py-10", right && "text-right tabular-nums", className)}>{children}</td>;
}

export const usd = (v: bigint | undefined, opts?: { compact?: boolean }) =>
  formatUsd(v ?? 0n, { displayDecimals: 2, ...opts }) ?? "$0.00";

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const dayLabel = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/** bps of a fee, rendered the way a partner thinks about it: a percentage. */
export const bpsToPct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
