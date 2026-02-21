import { t } from "@lingui/macro";
import { useCallback, useMemo, useRef } from "react";

import { USD_DECIMALS } from "config/factors";
import {
  selectTradeboxMarketInfo,
  selectTradeboxMarkPrice,
} from "context/SyntheticsStateContext/selectors/tradeboxSelectors";
import { useSelector } from "context/SyntheticsStateContext/utils";
import { isIncreaseOrderType } from "domain/synthetics/orders";
import { SidecarOrderEntry, SidecarOrderEntryGroup } from "domain/synthetics/sidecarOrders/useSidecarOrders";
import { TokenData } from "domain/synthetics/tokens";
import { calculateDisplayDecimals, formatAmount, formatUsd, formatUsdPrice } from "lib/numbers";
import { getTokenVisualMultiplier } from "sdk/configs/tokens";

import { NUMBER_WITH_TWO_DECIMALS } from "components/PercentageInput/PercentageInput";
import SuggestionInput from "components/SuggestionInput/SuggestionInput";
import TooltipWithPortal from "components/Tooltip/TooltipWithPortal";

import PlusIcon from "img/ic_plus.svg?react";

import { EntryButton } from "./EntryButton";

const SUGGESTION_PERCENTAGE_LIST = [10, 25, 50, 75, 100];

interface SidecarEntryProps {
  entry: SidecarOrderEntry;
  commonError?: {
    price?: string;
    percentage?: string;
  } | null;
  indexToken?: TokenData;
  displayMode: "sizeUsd" | "percentage";
  updateEntry: (id: string, field: "sizeUsd" | "percentage" | "price", value: string) => void;
  deleteEntry: (id: string) => void;
  entriesCount: number;
  priceShortcuts?: number[];
  referencePrice?: bigint;
}

function SideOrderEntry({
  entry,
  commonError,
  indexToken,
  displayMode,
  entriesCount,
  updateEntry,
  deleteEntry,
  priceShortcuts,
  referencePrice,
}: SidecarEntryProps) {
  const percentageError = commonError?.percentage || entry.percentage?.error;
  const priceError = commonError?.price || entry.price?.error;
  const sizeError = displayMode === "percentage" ? percentageError : entry.sizeUsd?.error;

  const isIncrease = entry.order && isIncreaseOrderType(entry.order.orderType);
  const isLong = entry.order?.isLong;

  const priceTooltipMsg =
    indexToken &&
    entry.price?.value &&
    entry.sizeUsd?.value &&
    `${isIncrease ? "Increase" : "Decrease"} ${getTokenVisualMultiplier(indexToken)}${
      indexToken.baseSymbol || indexToken.symbol
    } ${isLong ? "Long" : "Short"} by ${formatUsd(entry.sizeUsd.value)} at ${formatUsdPrice(
      entry.price.value ?? undefined,
      {
        visualMultiplier: indexToken.visualMultiplier,
      }
    )}.`;

  const sizeTooltipMsg =
    sizeError || priceTooltipMsg ? (
      <>
        {sizeError}
        {sizeError && priceTooltipMsg && (
          <>
            <br />
            <br />
          </>
        )}
        {priceTooltipMsg}
      </>
    ) : null;

  const onPriceValueChange = useCallback(
    (value) => {
      updateEntry(entry.id, "price", value);
    },
    [updateEntry, entry.id]
  );

  const handlePriceShortcut = useCallback(
    (pct: number) => {
      if (referencePrice === undefined) return;

      const bps = BigInt(Math.round(pct * 100));
      const adjustedPrice = (referencePrice * (10000n + bps)) / 10000n;
      const displayDecimals = calculateDisplayDecimals(adjustedPrice, undefined, indexToken?.visualMultiplier);
      const formatted = formatAmount(
        adjustedPrice,
        USD_DECIMALS,
        displayDecimals,
        undefined,
        undefined,
        indexToken?.visualMultiplier
      );

      updateEntry(entry.id, "price", formatted);
    },
    [referencePrice, indexToken?.visualMultiplier, updateEntry, entry.id]
  );

  const onSizeUsdValueChange = useCallback(
    (value) => {
      updateEntry(entry.id, "sizeUsd", value);
    },
    [updateEntry, entry.id]
  );

  const onPercentageSetValue = useCallback(
    (value) => {
      if (NUMBER_WITH_TWO_DECIMALS.test(value) || value.length === 0) {
        updateEntry(entry.id, "percentage", value);
      }
    },
    [updateEntry, entry.id]
  );

  const onDeleteEntry = useCallback(() => deleteEntry(entry.id), [deleteEntry, entry.id]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-row gap-4">
        <TooltipWithPortal
          disabled={!priceError}
          content={priceError}
          tooltipClassName="!min-w-[25rem]"
          position="top-end"
          variant="none"
        >
          <SuggestionInput
            label="$"
            isError={!!priceError}
            className="w-88"
            value={entry.price.input}
            setValue={onPriceValueChange}
            placeholder={t`Price`}
          />
        </TooltipWithPortal>
        {displayMode === "percentage" && (
          <div className="group relative">
            <TooltipWithPortal
              disabled={!sizeTooltipMsg}
              content={sizeTooltipMsg}
              tooltipClassName="!min-w-[25rem]"
              position="top-end"
              variant="none"
            >
              <SuggestionInput
                isError={!!percentageError}
                className="w-64"
                value={entry.percentage?.input ?? ""}
                setValue={onPercentageSetValue}
                suggestionList={SUGGESTION_PERCENTAGE_LIST}
                placeholder={t`Size`}
                symbol="%"
              />
            </TooltipWithPortal>
          </div>
        )}
        {displayMode === "sizeUsd" && (
          <TooltipWithPortal
            disabled={!sizeTooltipMsg}
            content={sizeTooltipMsg}
            tooltipClassName="!min-w-[25rem]"
            position="top-end"
            variant="none"
          >
            <SuggestionInput
              isError={!!sizeError}
              className="w-81"
              value={entry.sizeUsd.input ?? ""}
              setValue={onSizeUsdValueChange}
              placeholder={t`Size`}
              label="$"
            />
          </TooltipWithPortal>
        )}

        <EntryButton
          onClick={onDeleteEntry}
          disabled={entriesCount === 1 && !entry.percentage && !entry.price}
          theme="red"
        >
          <PlusIcon className="size-12 rotate-45" />
        </EntryButton>
      </div>
      {priceShortcuts && referencePrice !== undefined && (
        <div className="flex items-center gap-4">
          {priceShortcuts.map((pct) => (
            <button
              key={pct}
              type="button"
              className="cursor-pointer rounded-4 bg-slate-700 px-6 py-2 text-body-small text-typography-secondary gmx-hover:bg-slate-600 gmx-hover:text-typography-primary"
              onClick={() => handlePriceShortcut(pct)}
            >
              {pct > 0 ? `+${pct}%` : `${pct}%`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type SidecarEntriesProps = {
  entriesInfo: SidecarOrderEntryGroup;
  displayMode: "percentage" | "sizeUsd";
  priceShortcuts?: number[];
};

export function SideOrderEntries({ entriesInfo, displayMode, priceShortcuts }: SidecarEntriesProps) {
  const marketInfo = useSelector(selectTradeboxMarketInfo);
  const markPrice = useSelector(selectTradeboxMarkPrice);
  const { updateEntry, deleteEntry } = entriesInfo;
  const containerRef = useRef<HTMLDivElement>(null);

  const displayableEntries = useMemo(
    () => entriesInfo.entries.filter((entry) => entry.txnType !== "cancel"),
    [entriesInfo]
  );

  return (
    <div className="grid gap-y-3" ref={containerRef}>
      {displayableEntries?.map((entry) => (
        <SideOrderEntry
          key={entry.id}
          entry={entry}
          commonError={entriesInfo.error}
          entriesCount={entriesInfo.entries.length}
          indexToken={marketInfo?.indexToken}
          displayMode={displayMode}
          updateEntry={updateEntry}
          deleteEntry={deleteEntry}
          priceShortcuts={priceShortcuts}
          referencePrice={markPrice ?? undefined}
        />
      ))}
    </div>
  );
}
