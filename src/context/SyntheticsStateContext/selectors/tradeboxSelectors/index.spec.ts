import { describe, expect, it } from "vitest";

import { BASIS_POINTS_DIVISOR } from "config/factors";
import { getTradeboxLeverageSliderMarks } from "domain/synthetics/markets";

describe("tradeboxSelectors", () => {
  it("selectTradeboxLeverageSliderMarks", () => {
    // Input is now the allowed max leverage (after /1.5 safety factor)
    expect(getTradeboxLeverageSliderMarks(50 * BASIS_POINTS_DIVISOR)).toEqual([0.1, 1, 2, 5, 10, 25, 50]);
    expect(getTradeboxLeverageSliderMarks(60 * BASIS_POINTS_DIVISOR)).toEqual([0.1, 1, 2, 5, 10, 25, 50, 60]);
    expect(getTradeboxLeverageSliderMarks(70 * BASIS_POINTS_DIVISOR)).toEqual([0.1, 1, 2, 5, 10, 30, 50, 70]);
    expect(getTradeboxLeverageSliderMarks(75 * BASIS_POINTS_DIVISOR)).toEqual([0.1, 1, 2, 5, 10, 30, 50, 75]);
    expect(getTradeboxLeverageSliderMarks(80 * BASIS_POINTS_DIVISOR)).toEqual([0.1, 1, 2, 5, 10, 50, 80]);
    expect(getTradeboxLeverageSliderMarks(90 * BASIS_POINTS_DIVISOR)).toEqual([0.1, 1, 2, 5, 10, 50, 90]);

    // Crypto markets (MCF=0.006666 → 100x allowed)
    expect(getTradeboxLeverageSliderMarks(100 * BASIS_POINTS_DIVISOR)).toEqual([0.1, 1, 2, 5, 10, 25, 50, 100]);

    expect(getTradeboxLeverageSliderMarks(110 * BASIS_POINTS_DIVISOR)).toEqual([0.1, 1, 2, 5, 10, 25, 50, 100, 110]);
    expect(getTradeboxLeverageSliderMarks(120 * BASIS_POINTS_DIVISOR)).toEqual([0.1, 1, 2, 5, 10, 30, 60, 120]);
    expect(getTradeboxLeverageSliderMarks(125 * BASIS_POINTS_DIVISOR)).toEqual([0.1, 1, 2, 5, 10, 50, 100, 125]);

    // Commodity markets (MCF=0.003333 → 200x allowed)
    expect(getTradeboxLeverageSliderMarks(200 * BASIS_POINTS_DIVISOR)).toEqual([0.1, 1, 2, 5, 10, 50, 100, 200]);

    // FX markets (MCF=0.001333 → 500x allowed)
    expect(getTradeboxLeverageSliderMarks(500 * BASIS_POINTS_DIVISOR)).toEqual([0.1, 1, 2, 5, 10, 50, 100, 500]);
  });
});
