# Coding Conventions

**Analysis Date:** 2026-02-20

## Naming Patterns

**Files:**
- Components: PascalCase with .tsx extension (e.g., `ChainDataImage.tsx`, `TradeHistoryRow.tsx`)
- Utilities: camelCase with .ts extension (e.g., `searchBy.ts`, `getPauseableInterval.ts`)
- Hooks: camelCase starting with "use" (e.g., `useGmxAccountSelector.ts`, `useTradeboxState.ts`)
- Tests: suffix with .spec.ts or .spec.tsx (e.g., `searchBy.spec.ts`, `getBestNonce.spec.ts`)
- Domain modules: lowercase directory names (e.g., `synthetics/`, `multichain/`)
- Context: PascalCase directories with Provider suffix (e.g., `GmxAccountContext/`, `SyntheticsStateContext/`)

**Functions:**
- camelCase for regular functions and methods
- Prefix with "use" for React hooks (e.g., `useGmxAccountSelector`, `useChainId`)
- Prefix with "get" for pure utility/compute functions (e.g., `getMaxLeverageByMinCollateralFactor`)
- Prefix with "select" for context selectors (e.g., `selectGmxAccountModalOpen`, `selectTradeboxTradeErrors`)
- Prefix with "use" + "Request" for data fetching hooks (e.g., `useMarketsInfoRequest`, `useOrdersInfoRequest`)

**Variables:**
- camelCase for all variables
- Use underscore prefix for intentionally unused parameters (e.g., `const { error, _ } = ...`)
- Context instances: lowercase (e.g., `context`)
- Boolean variables may use "is" or "has" prefix: `isLoading`, `hasError`

**Types:**
- PascalCase for all type and interface names (e.g., `TokenData`, `GmxAccountContext`, `TradeboxState`)
- Enums: PascalCase with PascalCase values (e.g., `enum Operation { Deposit = "Deposit", Withdraw = "Withdraw" }`)
- Generic types: single uppercase letter (T, K, V) or descriptive (Selected, Result)

## Code Style

**Formatting:**
- Prettier with custom config in `.prettierrc.json`
- Print width: 120 characters
- Trailing commas: ES5 style (objects/arrays, no function params)
- Quotes: double quotes for strings
- Semicolons: required
- Tailwind classes: sorted using prettier-plugin-tailwindcss

**Linting:**
- ESLint with TypeScript and React rules from `.eslintrc.json`
- Max warnings allowed: 0 (checked in lint-staged)
- Console warnings enforced (console.log triggers warnings, console.error is allowed)
- No unused variables (except when prefixed with underscore)
- Regex patterns for unused args: `^_` (e.g., `_error`, `_unused`)

**Strict Compiler Settings:**
- TypeScript strict mode: disabled globally (`"strict": false`)
- But individual strict checks enabled:
  - `strictNullChecks: true` - null/undefined checking
  - `strictFunctionTypes: true` - function type checking
  - `strictBindCallApply: true` - bind/call/apply checking
  - `noImplicitThis: true` - this context must be explicit
- No emit on errors
- Module: esnext, Module resolution: node

## Import Organization

**Order (enforced by eslint-plugin-import):**
1. External dependencies (builtin and node modules): `import { foo } from "bar"`
2. Internal absolute imports: `import { thing } from "config"`, `import { Component } from "components"`
3. Relative imports: `import { util } from "../utils"`, `import { helper } from "./helper"`

**Path Aliases (from tsconfig.json and vite.config.ts):**
```
sdk → ../sdk/src
components → ./src/components
config → ./src/config
context → ./src/context
domain → ./src/domain
lib → ./src/lib
styles → ./src/styles
prebuilt → ./src/prebuilt
img → ./src/img
```

**Examples:**
```typescript
// Correct order
import { ethers } from "ethers";
import { useRouter } from "react-router-dom";

import { ChainId } from "config/chains";
import { useChainId } from "lib/chains";
import { Component } from "components/Component";

import { localHelper } from "./helper";
import { sibling } from "../sibling";
```

## Error Handling

**Patterns:**
- Use try-catch for async operations that may throw
- Re-throw errors after logging metrics with custom error context
- Parse errors using `parseError()` utility before logging
- Create ErrorLike types for serializable error data
- Use error context/scope (e.g., `errorContext: "sending"`, `errorContext: "execution"`)
- Errors in tests use `vi.fn()` for mocking and `expect(res).rejects.toThrow()`

**Example from `lib/metrics/utils.ts`:**
```typescript
const errorData = parseError(error);
const extendedError = extendError(error, { originalError: parseError(error) });
```

## Logging

**Framework:** console (no custom logger library)

**Patterns:**
- Warning level: `console.warn()` - triggers ESLint warning
- Error level: `console.error()` - allowed
- Debug/info: wrapped in condition checks or use debugger
- NO console.log in production code (ESLint will warn)
- Metrics/analytics sent via custom error tracking (see metrics utilities)

## Comments

**When to Comment:**
- Complex algorithm logic requiring explanation
- Non-obvious workarounds or hacks (use TODO comments)
- JSDoc comments on public functions/exports in domain modules
- Explain "why" not "what" - code should be clear enough for "what"

**JSDoc/TSDoc:**
- Used minimally, only on exported functions in domain modules
- Format: `/** description */` on single line or multi-line

**Example:**
```typescript
/**
 * If you just need the settlement chain id and not updating it, use `useChainId` instead
 */
export function useGmxAccountSettlementChainId() {
  return [...];
}
```

## Function Design

**Size:**
- Prefer small, focused functions (< 50 lines)
- Acceptable: 100-200 line context providers or hooks with multiple data fetches
- Utilities in domain/ directory tend to be small 20-40 lines

**Parameters:**
- Use object parameters for functions with > 2 params (destructured)
- Destructure in function signature when possible
- Type destructured params explicitly

**Return Values:**
- Use const assertions `as const` for tuple returns
- Return objects for multiple related values
- Use readonly tuples for hook returns following React pattern: `[value, setter]`

**Example from hooks:**
```typescript
export function useGmxAccountDepositViewChain() {
  return [
    useGmxAccountSelector(selectGmxAccountDepositViewChain),
    useGmxAccountSelector(selectGmxAccountSetDepositViewChain),
  ] as const;
}
```

## Module Design

**Exports:**
- Use named exports exclusively (no default exports in general)
- Re-export barrel index files (e.g., `context/index.ts`)
- SDK exports use package.json exports field for fine-grained control

**Barrel Files:**
- Used in context directories: `context/SyntheticsStateContext/index.ts`
- Used in domain modules with multiple sub-modules
- Keep barrel files minimal - only export public interfaces

**Example structure:**
```
src/context/GmxAccountContext/
├── GmxAccountContext.tsx (defines context)
├── hooks.ts (exports: useGmxAccountModalOpen, useGmxAccountSelector, etc)
├── selectors.ts (exports: selectGmxAccountModalOpen, etc)
└── index.ts (re-exports from hooks and selectors)
```

## React Patterns

**Component Structure:**
- Functional components only (no class components)
- Props destructured in function signature
- CSS: Tailwind classes in className prop, sorted by prettier plugin
- Context consumption: use `use-context-selector` with specific selectors

**Example:**
```typescript
import { useContextSelector } from "use-context-selector";

export function Component({ prop1, prop2 }: Props) {
  const value = useContextSelector(context, selector);

  return <div className="flex items-center gap-2 rounded-lg bg-blue-300">{value}</div>;
}
```

**Hooks:**
- Extract custom hooks into separate files
- Hooks return tuples (React state pattern) or objects (for multiple unrelated values)
- Use `useMemo` and `useCallback` sparingly - only when measuring shows perf issues

## TypeScript Specifics

**Typing:**
- Use `readonly` for immutable data structures
- Use `bigint` type for large numbers (not string or Number)
- Use generics extensively for selector hooks: `<Selected>`
- Union types over boolean flags: `type Status = "loading" | "success" | "error"`

**Type Assertions:**
- Avoid `any` type (ESLint allows it, but discouraged)
- Casting with `as Type` acceptable in tests and when type system is too strict
- Non-null assertions `!` used sparingly, must be justified

---

*Convention analysis: 2026-02-20*
