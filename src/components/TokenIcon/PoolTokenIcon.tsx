import cx from "classnames";
import { ComponentType, SVGProps } from "react";

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

type Props = {
  symbol: string;
  displaySize: number;
  badge?: string | readonly [topSymbol: string, bottomSymbol: string];
  className?: string;
  badgeClassName?: string;
};

export function PoolTokenIcon({ symbol, displaySize, badge, className, badgeClassName }: Props) {
  const SvgIcon = getSvgComponent(symbol, displaySize >= 40 ? 40 : 24);

  if (!SvgIcon) return null;

  const mainIcon = (
    <SvgIcon
      width={displaySize}
      height={displaySize}
      className="block rounded-full"
    />
  );

  if (!badge) {
    return <div className={cx("inline-flex", className)}>{mainIcon}</div>;
  }

  if (typeof badge === "string") {
    return (
      <div className={cx("flex flex-col", className)}>
        {mainIcon}
        <span
          className={cx(
            "pointer-events-none z-10 -mt-12 self-end -mr-8 rounded-20 bg-slate-700 px-6 py-2 text-12 font-medium text-typography-secondary",
            badgeClassName
          )}
        >
          {badge}
        </span>
      </div>
    );
  }

  const BadgeIcon0 = getSvgComponent(badge[0], 24);
  const BadgeIcon1 = getSvgComponent(badge[1], 24);

  return (
    <div className={cx("flex flex-col", className)}>
      {mainIcon}
      <span
        className={cx(
          "-mt-12 -mr-8 flex self-end text-typography-secondary",
          badgeClassName
        )}
      >
        {BadgeIcon0 && (
          <BadgeIcon0
            width={20}
            height={20}
            className="z-20 -mr-10 rounded-[100%] border-2 border-slate-900 bg-slate-900"
          />
        )}
        {BadgeIcon1 && (
          <BadgeIcon1
            width={20}
            height={20}
            className="z-10 rounded-[100%] border-2 border-slate-900 bg-slate-900"
          />
        )}
      </span>
    </div>
  );
}
