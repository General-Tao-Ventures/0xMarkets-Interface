import { describe, expect, it } from "vitest";

import { PRECISION } from "../numbers";
import {
  invertUsdPrice,
  isFxDisplayReversedSymbol,
  toFxDisplayIsLong,
  toFxDisplayPrice,
  toFxIndexIsLong,
  toFxIndexPrice,
} from "../fxDisplay";

describe("fxDisplay", () => {
  it("marks JPY as display-reversed", () => {
    expect(isFxDisplayReversedSymbol("JPY")).toBe(true);
    expect(isFxDisplayReversedSymbol("EUR")).toBe(false);
  });

  it("round-trips USD/JPY ↔ JPY/USD for exact-divisible prices", () => {
    const jpyUsd = PRECISION / 158n; // ~0.006329
    const usdJpy = invertUsdPrice(jpyUsd);

    expect(usdJpy).toBeGreaterThan(100n * PRECISION); // ~158
    expect(toFxDisplayPrice(jpyUsd, "JPY")).toBe(usdJpy);
    expect(toFxIndexPrice(usdJpy, "JPY")).toBe(jpyUsd);
    expect(toFxDisplayPrice(jpyUsd, "EUR")).toBe(jpyUsd);
  });

  it("flips Long/Short for USD/JPY UX", () => {
    expect(toFxDisplayIsLong(true, "JPY")).toBe(false);
    expect(toFxIndexIsLong(true, "JPY")).toBe(false);
    expect(toFxDisplayIsLong(true, "EUR")).toBe(true);
    expect(toFxIndexIsLong(false, "JPY")).toBe(true);
  });
});
