# Testing Patterns

**Analysis Date:** 2026-02-20

## Test Framework

**Runner:**
- Vitest 2.0.5 (main app) and 3.0.4 (SDK)
- Config: `vite.config.ts` contains test configuration
- Environment: happy-dom (lightweight DOM simulation)
- Global setup: `vitest.global-setup.js`

**Assertion Library:**
- Vitest built-in expect() - compatible with Jest assertions
- Available matchers: `.toHaveLength()`, `.toEqual()`, `.toBe()`, `.rejects`, `.resolves`, etc.
- Snapshot testing: `.toMatchInlineSnapshot()`

**Run Commands:**
```bash
yarn test              # Run tests in watch mode
yarn test:ci           # Run all tests once (CI mode)
```

**Coverage:**
- No coverage requirement enforced
- Coverage reports: can be generated but not committed

## Test File Organization

**Location:**
- Co-located with source files: `feature.spec.ts` next to `feature.ts`
- Domain utilities: `domain/synthetics/markets/glv.spec.ts` next to `glv.ts`
- Component utilities: `components/TradeHistory/TradeHistoryRow/utils.spec.ts` next to `utils.ts`
- Tests in `__tests__/` subdirectories when multiple related tests: `lib/__tests__/getBestNonce.spec.ts`

**Naming:**
- Pattern: `[filename].spec.ts` or `[filename].spec.tsx`
- Examples: `searchBy.spec.ts`, `glv.spec.ts`, `getBestNonce.spec.ts`

**Structure:**
```
src/
├── lib/
│   ├── searchBy.ts
│   ├── searchBy.spec.ts           # Co-located
│   ├── __tests__/
│   │   ├── getBestNonce.spec.ts
│   │   ├── getLiquidationPrice.spec.ts
│   │   └── ethersErrors.spec.ts
│   └── contracts/
│       └── utils.ts
├── domain/
│   └── synthetics/
│       ├── markets/
│       │   ├── glv.ts
│       │   └── glv.spec.ts        # Co-located
│       └── utils.spec.ts
└── components/
    └── TwapRows/
        ├── __tests__/
        │   └── TwapRows.spec.ts
        └── TwapRows.tsx
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

describe("searchBy", () => {
  // Test setup (optional)
  beforeEach(() => {
    // Setup before each test
  });

  // Individual tests
  it("should search by a single field", () => {
    // Arrange
    const items = [...];

    // Act
    const result = searchBy(items, ["name"], "bitcoin");

    // Assert
    expect(result).toHaveLength(1);
  });

  // Cleanup (optional)
  afterEach(() => {
    // Cleanup after each test
  });
});
```

**Patterns:**
- One `describe()` block per function/module
- Multiple `it()` or `test()` blocks for different cases
- Descriptive test names: "should [expected behavior]" or "Case 1", "Case 2" for exhaustive testing
- Arrange-Act-Assert pattern implicit in test structure
- Use `beforeEach()` for common setup (mocks, fake timers)
- Use `afterEach()` for cleanup (restore mocks, real timers)

## Mocking

**Framework:** Vitest built-in `vi` module

**Patterns:**

**Mock Functions:**
```typescript
const mockCallback = vi.fn().mockReturnValue(42);
const mockAsync = vi.fn().mockImplementation(async ({ value }) => value + 1);

// Call assertions
expect(mockCallback).toHaveBeenCalledTimes(1);
expect(mockCallback).toHaveBeenLastCalledWith({ prop: true });
```

**Fake Timers:**
```typescript
describe("PauseableInterval", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("should call callback at interval", async () => {
    new PauseableInterval(mockCallback, 1000);

    await vi.advanceTimersByTimeAsync(0);     // Initial call
    expect(mockCallback).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);  // Next interval
    expect(mockCallback).toHaveBeenCalledTimes(2);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });
});
```

**Console Spy:**
```typescript
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(vi.fn());
});
```

**What to Mock:**
- External API calls (replace with mock implementations returning test data)
- Timers (vi.useFakeTimers for interval/timeout testing)
- Promises (use vi.fn().mockResolvedValue() or .mockRejectedValue())
- Console methods (when testing error handling)
- Wallet providers (see getBestNonce.spec.ts for MockWallet pattern)

**What NOT to Mock:**
- Core utility functions being tested
- React components in unit tests (test utilities directly instead)
- Module imports used by code under test (unless testing error paths)
- Business logic (only mock I/O boundaries)

## Fixtures and Factories

**Test Data:**

Mocks directory pattern (when multiple tests share data):
```typescript
// src/components/TradeHistory/TradeHistoryRow/mocks.ts
export const cancelOrderIncreaseLong = { /* mock order */ };
export const createOrderDecreaseLong = { /* mock order */ };
export const liquidated = { /* mock position */ };

// Used in spec:
import { cancelOrderIncreaseLong } from "./mocks";
describe("TradeHistoryRow helpers", () => {
  it("formats position message", () => {
    expect(formatPositionMessage(cancelOrderIncreaseLong, minCollateralUsd))
      .toMatchInlineSnapshot(`...`);
  });
});
```

Simple inline fixtures (for single-test utilities):
```typescript
describe("searchBy", () => {
  it("should search by a single field", () => {
    const items = [
      { id: 1, name: "Bitcoin", symbol: "BTC" },
      { id: 2, name: "Ethereum", symbol: "ETH" },
    ];

    const result = searchBy(items, ["name"], "bitcoin");
    expect(result).toHaveLength(1);
  });
});
```

**Location:**
- Co-located mocks: `[feature]/mocks.ts` next to spec file
- Shared fixtures: in `test/` directory at project root (if needed)
- Inline fixtures: directly in spec file for simple data

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
# Generate coverage report (if needed)
yarn test --coverage
```

## Test Types

**Unit Tests:**
- Scope: Single function/utility in isolation
- Approach: Import function, call with test data, assert output
- Examples: `searchBy.spec.ts`, `glv.spec.ts`, `getBestNonce.spec.ts`
- Fast execution: < 100ms per test
- No mocking of code under test

**Integration Tests:**
- Scope: Multiple functions/modules working together
- Approach: Test data flow through compute pipeline
- Example: `TradeHistoryRow/utils.spec.ts` tests format functions with real mock data
- Use snapshot testing for complex output validation
- Mock external dependencies only

**E2E Tests:**
- Framework: Not used in main codebase
- Autotests directory exists: `autotests/src/tests/` (Playwright-style)
  - `nanvigation.spec.ts` - navigation flows
  - `trade.spec.ts` - trading workflows
  - `wallet.spec.ts` - wallet integration
- These are separate from unit/integration tests

## Async Testing

**Patterns:**

**Promise Resolution:**
```typescript
test("Case 1", async () => {
  const res = getBestNonce(providers);
  vi.advanceTimersByTime(400);
  expect(res).resolves.toBe(3);
});
```

**Async/Await:**
```typescript
it("should handle async callbacks", async () => {
  const mockCallback = vi.fn().mockImplementation(async ({ value }) => {
    return value + 1;
  });

  new PauseableInterval(mockCallback, 1000);

  await vi.advanceTimersByTimeAsync(0);
  expect(mockCallback).toHaveBeenCalledTimes(1);
});
```

**Tick Advancement:**
```typescript
vi.advanceTimersByTime(100);          // Sync advancement
await vi.advanceTimersByTimeAsync(100); // Async advancement
```

## Error Testing

**Patterns:**

**Promise Rejection:**
```typescript
test("Case 4", async () => {
  const providers: any[] = [
    new MockWallet(1, false, 100),
    new MockWallet(2, false, 200),
  ];
  const res = getBestNonce(providers);
  vi.advanceTimersByTime(400);

  res.catch((error) => {
    expect(error).toBeDefined();
  });
});
```

**Inline Error Assertion:**
```typescript
expect(() => {
  // Code that should throw
  riskyFunction();
}).toThrow(ExpectedErrorType);
```

**Async Error Handling:**
```typescript
await expect(asyncFunction()).rejects.toThrow();
```

## Snapshot Testing

**Pattern:**
```typescript
it("formats position message", () => {
  const result = formatPositionMessage(requestIncreasePosition, minCollateralUsd);

  expect(result).toMatchInlineSnapshot(`
    {
      "acceptablePrice": ">  $\u200a\u200d35.0578",
      "action": "Request Market Increase",
      ...
    }
  `);
});
```

**When to Use:**
- Complex computed output (formatting, data transformation)
- Output with many fields or nested structure
- Easier to review than verbose field assertions

**When NOT to Use:**
- Simple boolean/scalar assertions
- Data that changes frequently
- IDs or timestamps that aren't deterministic

## Common Testing Scenarios

**Testing with BigInt:**
```typescript
describe("domain/synthetics/utils", () => {
  it("getMaxLeverageByMinCollateralFactor", () => {
    expect(getMaxLeverageByMinCollateralFactor(5000000000000000000000000000n))
      .toBe(200 * BASIS_POINTS_DIVISOR);
  });
});
```

**Testing Selectors with Real Data:**
```typescript
import { BASIS_POINTS_DIVISOR } from "config/factors";

it("selectTradeboxLeverageSliderMarks", () => {
  expect(getTradeboxLeverageSliderMarks(100 * BASIS_POINTS_DIVISOR))
    .toEqual([0.1, 1, 2, 5, 10, 25, 50]);
});
```

**Testing Multi-Case Logic:**
Exhaustive test cases with descriptive names:
```typescript
describe("getBestNonce", () => {
  test("Case 1 - all succeed", async () => { ... });
  test("Case 2 - middle fails", async () => { ... });
  test("Case 3 - first two fail", async () => { ... });
  // ... up to Case 17 for complex scenarios
});
```

---

*Testing analysis: 2026-02-20*
