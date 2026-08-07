import cx from "classnames";
import { useMemo } from "react";
import type { Address } from "viem";

import { selectAvailableChartTokens } from "context/SyntheticsStateContext/selectors/chartSelectors";
import { selectChartToken } from "context/SyntheticsStateContext/selectors/chartSelectors";
import { selectChainId, selectTokensData } from "context/SyntheticsStateContext/selectors/globalSelectors";
import { selectTradeboxChooseSuitableMarket } from "context/SyntheticsStateContext/selectors/tradeboxSelectors";
import { useSelector } from "context/SyntheticsStateContext/utils";
import { useTokensFavorites } from "context/TokensFavoritesContext/TokensFavoritesContextProvider";
import { use24hPriceDeltaMap } from "domain/synthetics/tokens";
import { getMidPrice } from "domain/tokens/utils";
import { formatUsdPrice } from "lib/numbers";
import { isChartAvailableForToken, getTokenVisualMultiplier } from "sdk/configs/tokens";

import TokenIcon from "components/TokenIcon/TokenIcon";

export function FavoriteTokenBar() {
  const chainId = useSelector(selectChainId);
  const availableTokens = useSelector(selectAvailableChartTokens);
  const tokensData = useSelector(selectTokensData);
  const { chartToken } = useSelector(selectChartToken);
  const chooseSuitableMarket = useSelector(selectTradeboxChooseSuitableMarket);

  const { favoriteTokens } = useTokensFavorites("chart-token-selector");

  const availableChartTokens = useMemo(() => {
    return availableTokens?.filter((token) => isChartAvailableForToken(chainId, token.symbol));
  }, [availableTokens, chainId]);

  const favoriteChartTokens = useMemo(() => {
    if (!availableChartTokens || !favoriteTokens.length) return [];

    return availableChartTokens.filter((token) => favoriteTokens.includes(token.address));
  }, [availableChartTokens, favoriteTokens]);

  const availableChartTokenAddresses = useMemo(() => {
    return favoriteChartTokens?.map((token) => token.address as Address);
  }, [favoriteChartTokens]);

  const dayPriceDeltaMap = use24hPriceDeltaMap(chainId, availableChartTokenAddresses);

  if (!favoriteChartTokens.length) return null;

  const handleTokenSelect = (tokenAddress: string) => {
    chooseSuitableMarket(tokenAddress);
  };

  return (
    <div className="flex items-center overflow-x-auto scrollbar-hide rounded-8 border border-slate-800 bg-slate-750">
      {favoriteChartTokens.map((token) => {
        const tokenData = tokensData?.[token.address];
        const dayPriceDelta = dayPriceDeltaMap?.[token.address];
        const isActive = chartToken?.address === token.address;
        const displaySymbol = token.baseSymbol || token.symbol;
        const displayDecimals = token.priceDecimals ?? 2;

        const price = tokenData
          ? formatUsdPrice(getMidPrice(tokenData.prices), {
              visualMultiplier: tokenData.visualMultiplier,
              displayDecimals,
            })
          : "-";

        return (
          <button
            key={token.address}
            className={cx(
              "flex w-[152px] flex-shrink-0 items-center gap-8 overflow-hidden px-12 py-8 transition-colors cursor-pointer",
              "hover:bg-slate-750",
              {
                "bg-slate-750": isActive,
              }
            )}
            onClick={() => handleTokenSelect(token.address)}
          >
            <TokenIcon
              symbol={displaySymbol}
              displaySize={20}
              importSize={24}
            />
            <div className="flex min-w-0 flex-col items-start text-left">
              <div className="flex items-center gap-4 text-12 font-medium text-typography-primary">
                {getTokenVisualMultiplier(token)}
                {displaySymbol}
              </div>
              <div className="flex w-full items-center gap-8 text-11 tabular-nums">
                <span className="min-w-0 truncate text-typography-secondary">{price}</span>
                <span
                  className={cx("ml-auto shrink-0 font-medium", {
                    "text-green-400": dayPriceDelta?.deltaPercentage && dayPriceDelta.deltaPercentage > 0,
                    "text-red-400": dayPriceDelta?.deltaPercentage && dayPriceDelta.deltaPercentage < 0,
                    "text-typography-secondary": !dayPriceDelta?.deltaPercentage,
                  })}
                >
                  {dayPriceDelta?.deltaPercentageStr ?? "—"}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
