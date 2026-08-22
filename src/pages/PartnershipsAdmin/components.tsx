import cx from "classnames";
import { ReactNode } from "react";

/** Whole-dollar or cents money, with the sign carried in front of the currency. */
export const money = (n: number, decimals = 2) =>
  `${n < 0 ? "−$" : "$"}${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

export const compact = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}m` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k` : money(n, 0);

export const pct = (n: number, decimals = 2) => `${n < 0 ? "−" : ""}${Math.abs(n).toFixed(decimals)}%`;

export const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export const day = (ts: number | null) =>
  ts ? new Date(ts * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/**
 * Trader P&L is quoted from the TRADER's side throughout the console, so the colours are inverted
 * on purpose: a trader losing money is the pool winning. Green here means good for the venue.
 */
export function Pnl({ value, render }: { value: number; render?: (v: number) => string }) {
  return (
    <span className={cx("tabular-nums", value > 0 ? "text-red-500" : value < 0 ? "text-green-500" : "")}>
      {(render ?? ((v: number) => money(v)))(value)}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="rounded-4 bg-slate-800 p-16">
      <div className="text-12 text-slate-100">{label}</div>
      <div
        className={cx(
          "mt-4 text-24 font-medium tabular-nums",
          tone === "pos" && "text-green-500",
          tone === "neg" && "text-red-500"
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-4 text-12 text-slate-100">{sub}</div> : null}
    </div>
  );
}

export function Tag({
  tone = "grey",
  children,
}: {
  tone?: "grey" | "blue" | "green" | "amber" | "red" | "violet";
  children: ReactNode;
}) {
  const tones = {
    grey: "bg-slate-700 text-slate-100",
    blue: "bg-blue-300/15 text-blue-300",
    green: "bg-green-500/15 text-green-500",
    amber: "bg-yellow-500/15 text-yellow-500",
    red: "bg-red-500/15 text-red-500",
    violet: "bg-[#8b5cf6]/15 text-[#a78bfa]",
  } as const;
  return <span className={cx("text-10 whitespace-nowrap rounded-full px-8 py-2", tones[tone])}>{children}</span>;
}

export function AdminCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-4 bg-slate-800", className)}>{children}</div>;
}

export function CardHead({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-8 p-16">
      <div>
        <h2 className="text-16 font-medium">{title}</h2>
        {sub ? <div className="mt-2 text-12 text-slate-100">{sub}</div> : null}
      </div>
      {right}
    </div>
  );
}

/** A wide table that scrolls inside its own card rather than pushing the page sideways. */
export function DataTable({ head, children }: { head: { label: ReactNode; right?: boolean }[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-13">
        <thead>
          <tr className="border-b border-slate-700 text-left text-12 text-slate-100">
            {head.map((h, i) => (
              <th key={i} className={cx("whitespace-nowrap px-12 py-8 font-normal", h.right && "text-right")}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Cell({
  children,
  right,
  mono,
  className,
}: {
  children: ReactNode;
  right?: boolean;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cx(
        "whitespace-nowrap px-12 py-10",
        right && "text-right tabular-nums",
        mono && "font-mono text-12",
        className
      )}
    >
      {children}
    </td>
  );
}

export function Empty({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-24 text-center text-13 text-slate-100">
        {children}
      </td>
    </tr>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2 rounded-4 bg-slate-700 p-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          className={cx(
            "rounded-4 px-10 py-6 text-12",
            o.value === value ? "bg-slate-800 text-white" : "text-slate-100"
          )}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
