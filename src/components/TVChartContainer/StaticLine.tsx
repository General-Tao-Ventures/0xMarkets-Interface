import { useEffect, useRef } from "react";

import { colors } from "config/colors";

import { LineStyle, StaticChartLine } from "./types";
import type { IChartingLibraryWidget, IPositionLineAdapter } from "../../charting_library";

const LONG_COLOR = colors.green[500].dark;
const SHORT_COLOR = colors.red[500].dark;

export function StaticLine({
  title,
  price,
  isLong,
  tvWidgetRef,
}: {
  tvWidgetRef: React.RefObject<IChartingLibraryWidget>;
} & StaticChartLine) {
  const lineApi = useRef<IPositionLineAdapter | undefined>(undefined);

  useEffect(() => {
    const chart = tvWidgetRef.current?.activeChart();
    if (!chart) {
      return;
    }

    chart.dataReady(() => {
      const range = chart.getVisibleRange();

      if (range.from === 0 && range.to === 0) {
        chart.onVisibleRangeChanged().subscribe(null, init, true);
      } else {
        init();
      }
    });

    function init() {
      const positionLine = chart!.createPositionLine({ disableUndo: true });
      const lineColor = isLong ? LONG_COLOR : SHORT_COLOR;

      lineApi.current = positionLine;

      return positionLine
        .setText(title)
        .setPrice(price)
        .setQuantity("")
        .setLineStyle(LineStyle.Dotted)
        .setLineLength(1)
        .setBodyFont(`normal 12pt "Relative", sans-serif`)
        .setBodyTextColor("#fff")
        .setLineColor(lineColor)
        .setBodyBackgroundColor(lineColor)
        .setBodyBorderColor(lineColor);
    }

    return () => {
      lineApi.current?.remove();
      lineApi.current = undefined;
    };
  }, [isLong, price, title, tvWidgetRef]);

  return null;
}
