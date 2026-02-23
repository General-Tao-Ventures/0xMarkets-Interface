import { Trans } from "@lingui/macro";
import { ReactNode } from "react";

export function EmptyTableContent({
  isLoading,
  isEmpty,
  emptyText = <Trans>No items yet</Trans>,
}: {
  isLoading: boolean;
  isEmpty: boolean;
  emptyText?: ReactNode;
}) {
  if (!isLoading && !isEmpty) return null;

  if (isLoading) {
    return (
      <div className="flex min-h-[164px] w-full grow items-center justify-center">
        <div className="flex flex-col items-center gap-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-slate-300" />
          <span className="text-[13px] text-typography-secondary">
            <Trans>Loading...</Trans>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[164px] w-full grow items-center justify-center text-[13px] text-typography-secondary">
      {emptyText}
    </div>
  );
}
