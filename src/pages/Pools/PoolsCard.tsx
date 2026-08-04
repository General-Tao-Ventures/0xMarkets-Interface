import cx from "classnames";
import { ReactNode } from "react";

export default function PoolsCard({
  children,
  title,
  description,
  titleAction,
  bottom,
  className,
}: {
  children: ReactNode;
  title: ReactNode;
  description: ReactNode;
  titleAction?: ReactNode;
  bottom?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("overflow-hidden rounded-8 border border-slate-800 bg-slate-750", className)}>
      <div className="flex h-full flex-col">
        <div className="flex flex-col gap-8 border-b-1/2 border-slate-800 p-16">
          <div className="flex items-start justify-between gap-12">
            <span className="text-h3 font-medium max-md:text-body-medium">{title}</span>
            {titleAction ? <div className="shrink-0">{titleAction}</div> : null}
          </div>
          <span className="text-body-medium text-typography-secondary max-md:text-body-small">{description}</span>
        </div>
        <div className="flex grow flex-col overflow-y-auto max-md:p-12">{children}</div>
        {bottom && <div className="border-t-1/2 border-slate-600 p-16">{bottom}</div>}
      </div>
    </div>
  );
}
