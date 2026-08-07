import cx from "classnames";
import { ComponentType, SVGProps } from "react";

import { getMarketLogoUrl } from "config/marketLogos";

type SvgComponent = ComponentType<SVGProps<SVGSVGElement>>;

const svgComponents40 = import.meta.glob<SvgComponent>("../../img/ic_*_40.svg", {
  query: "?react",
  import: "default",
  eager: true,
});

const svgComponents24 = import.meta.glob<SvgComponent>("../../img/ic_*_24.svg", {
  query: "?react",
  import: "default",
  eager: true,
});

function getSvgComponent(symbol: string, size: 24 | 40): SvgComponent | undefined {
  const key = `../../img/ic_${symbol.toLowerCase()}_${size}.svg`;
  const map = size === 40 ? svgComponents40 : svgComponents24;
  return map[key];
}

function TokenImg({
  symbol,
  displaySize,
  className,
}: {
  symbol: string;
  displaySize: number;
  className?: string;
}) {
  const marketLogo = getMarketLogoUrl(symbol);
  if (marketLogo) {
    return (
      <img
        src={marketLogo}
        alt={symbol}
        width={displaySize}
        height={displaySize}
        className={cx("block rounded-full object-cover", className)}
      />
    );
  }

  const SvgIcon = getSvgComponent(symbol, displaySize >= 40 ? 40 : 24);
  if (!SvgIcon) return null;

  return <SvgIcon width={displaySize} height={displaySize} className={cx("block rounded-full", className)} />;
}

type Props = {
  symbol: string;
  displaySize: number;
  badge?: string | readonly [topSymbol: string, bottomSymbol: string];
  className?: string;
  badgeClassName?: string;
};

export function PoolTokenIcon({ symbol, displaySize, badge, className, badgeClassName }: Props) {
  const mainIcon = <TokenImg symbol={symbol} displaySize={displaySize} />;

  if (!mainIcon) return null;

  if (!badge) {
    return <div className={cx("inline-flex", className)}>{mainIcon}</div>;
  }

  if (typeof badge === "string") {
    return (
      <div className={cx("flex flex-col", className)}>
        {mainIcon}
        <span
          className={cx(
            "pointer-events-none z-10 -mt-12 -mr-8 self-end rounded-20 bg-slate-700 px-6 py-2 text-12 font-medium text-typography-secondary",
            badgeClassName
          )}
        >
          {badge}
        </span>
      </div>
    );
  }

  return (
    <div className={cx("flex flex-col", className)}>
      {mainIcon}
      <span className={cx("-mt-12 -mr-8 flex self-end text-typography-secondary", badgeClassName)}>
        <span className="z-20 -mr-10 overflow-hidden rounded-[100%] border-2 border-slate-900 bg-slate-900">
          <TokenImg symbol={badge[0]} displaySize={20} />
        </span>
        <span className="z-10 overflow-hidden rounded-[100%] border-2 border-slate-900 bg-slate-900">
          <TokenImg symbol={badge[1]} displaySize={20} />
        </span>
      </span>
    </div>
  );
}
