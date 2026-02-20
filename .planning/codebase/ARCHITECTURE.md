# Architecture

**Analysis Date:** 2026-02-20

## Pattern Overview

**Overall:** Layered React application with domain-driven design and centralized state management

**Key Characteristics:**
- React 18 with Vite for fast development and optimized production builds
- Context API for global state management with multiple specialized contexts
- Domain-driven organization with feature-specific subdomains (synthetics, multichain, tokens, etc.)
- TypeScript for type safety with strict null checks enabled
- SDK abstraction layer for blockchain interactions

## Layers

**Presentation Layer (Components):**
- Purpose: React components for UI rendering and user interactions
- Location: `src/components/`
- Contains: Functional components organized by feature (TradeBox, OrderEditor, PositionSeller, etc.)
- Depends on: Context hooks, domain hooks, lib utilities
- Used by: Pages and other components

**Page Layer:**
- Purpose: Route-level page components and layout orchestration
- Location: `src/pages/`
- Contains: Top-level page components (SyntheticsPage, Pools, AccountDashboard, Stats, etc.)
- Depends on: Context providers, domain modules, components
- Used by: Router (AppRoutes)

**State Management Layer (Context):**
- Purpose: Application state management and global data access
- Location: `src/context/`
- Contains: React Context providers (GlobalContext, SyntheticsStateContext, ChainContext, SubaccountContext, etc.)
- Depends on: Domain modules for data, lib utilities
- Used by: Components and pages

**Domain Layer (Business Logic):**
- Purpose: Feature-specific logic, data transformation, and orchestration
- Location: `src/domain/`
- Contains: Subdomains for major features:
  - `synthetics/`: Trading, orders, positions, markets, express trading
  - `multichain/`: Cross-chain functionality
  - `tokens/`: Token data and management
  - `prices/`: Price feeds and calculations
  - `stats/`: Analytics and statistics
  - `referrals/`: Referral program logic
  - `stake/`: Staking functionality
- Depends on: SDK, lib utilities, context data
- Used by: Context providers, components

**Lib Layer (Utilities & Infrastructure):**
- Purpose: Reusable utilities, infrastructure, and lower-level functionality
- Location: `src/lib/`
- Contains:
  - `chains/`: Chain configuration and utilities
  - `contracts/`: Contract interaction helpers
  - `multicall/`: Batch contract calls
  - `rpc/`: RPC provider management
  - `wallets/`: Wallet connection and Web3 integration
  - `subgraph/`: Graph protocol queries
  - `metrics/`: Analytics and performance tracking
  - `numbers/`: Number formatting and calculations
  - `localStorage/`: Persistent state management
- Depends on: SDK, external libraries
- Used by: Domain, context, components

**SDK Layer (Blockchain Integration):**
- Purpose: Low-level blockchain interactions and abstraction
- Location: `sdk/src/`
- Contains:
  - `modules/`: Markets, Orders, Positions, Trades, Accounts, Tokens, Utils
  - `configs/`: Chain, token, contract configurations, ABIs
  - `utils/`: Multicall, contract calling, serialization helpers
  - `types/`: TypeScript type definitions
- Depends on: viem, ethers for blockchain operations
- Used by: Domain layer, context layer

**Config Layer:**
- Purpose: Application configuration and constants
- Location: `src/config/`
- Contains: Environment settings, chain configs, market configs, feature flags, localStorage keys
- Used by: All layers

## Data Flow

**Route Initialization Flow:**

1. User navigates to URL (e.g., `/trade`)
2. `AppRoutes.tsx` matches route and renders page
3. Page wraps children in `SyntheticsStateContextProvider`
4. Context provider initializes all state via domain hooks
5. Page components mount and use context selectors to read state
6. Components render with current data

**Trade Execution Flow:**

1. User fills out trade in `TradeBox` component
2. Component uses `selectTradeboxState` selector to read/write trade params
3. On submit, component calls `sendBatchOrderTxn` or swap handler from domain
4. Domain function uses SDK (`GmxSdk`) to build and execute transaction
5. `PendingTxnsContext` tracks transaction status
6. On confirmation, `SyntheticsStateContext` refetches affected data
7. Components re-render with updated state

**Data Fetching Flow:**

1. `SyntheticsStateContextProvider` mounts and calls domain request hooks
2. Request hooks (e.g., `useFastMarketsInfoRequest`, `useOrdersInfoRequest`) use SWR
3. SWR fetcher queries subgraph/RPC via SDK
4. Data stored in context state
5. Selectors derive computed state from context
6. Components subscribe to specific selectors
7. Only affected components re-render on data change

**State Management:**
- Global state: React Context API with centralized provider
- Local state: Component state with useState
- Persistent state: localStorage via `useLocalStorage` hooks
- Derived state: Selectors that compute values from context
- Request state: SWR handles loading/error/data states

## Key Abstractions

**SyntheticsStateContext:**
- Purpose: Central state container for all trading data
- Examples: `src/context/SyntheticsStateContext/SyntheticsStateContextProvider.tsx`
- Pattern: Provider exports `useSelector`, `useCalcSelector` hooks for accessing state
- Contains: Markets info, positions, orders, account stats, balances, gas data

**Domain Request Hooks:**
- Purpose: Encapsulate data fetching with caching and error handling
- Examples: `src/domain/synthetics/markets/useMarketsInfoRequest/`, `src/domain/synthetics/orders/useOrdersInfoRequest.ts`
- Pattern: Custom hooks that return `{ data, error, isLoading }` using SWR
- Benefits: Decouple data fetching from state management

**SDK Module System:**
- Purpose: Object-oriented interface to blockchain operations
- Examples: `sdk/src/modules/orders`, `sdk/src/modules/positions`
- Pattern: Each module has methods for reading/writing specific contract data
- Benefits: Chainable API, type safety, contract abstraction

**Selectors:**
- Purpose: Extract and compute specific state slices
- Examples: `src/context/SyntheticsStateContext/selectors/` directory
- Pattern: Pure functions that take state root and return derived value
- Benefits: Performance optimization via memoization, single source of truth

**Feature Flags:**
- Purpose: Enable/disable features dynamically
- Examples: `domain/synthetics/features/useDisabledFeatures.ts`
- Pattern: Hooks that check feature settings from context

## Entry Points

**Application Root:**
- Location: `src/index.tsx`
- Triggers: Browser loads HTML, script tag mounts React app
- Responsibilities: Create React root, wrap with WalletProvider, render App

**App Component:**
- Location: `src/App/App.tsx`
- Triggers: Called from index.tsx root render
- Responsibilities: Configure all context providers in correct order, set up i18n, initialize metrics

**Route Handler:**
- Location: `src/App/AppRoutes.tsx`
- Triggers: User navigates or hash changes
- Responsibilities: Match URL to page component, handle referral codes, manage toast notifications

**Main Routes:**
- Location: `src/App/MainRoutes.tsx`
- Triggers: AppRoutes renders MainRoutes
- Responsibilities: Define all routes and their context wrapper requirements

**Page Components:**
- Locations: `src/pages/SyntheticsPage/SyntheticsPage.tsx`, `src/pages/Pools/Pools.tsx`, etc.
- Triggers: Route matches and renders page
- Responsibilities: Orchestrate page-specific logic, render sections, handle page-level interactions

## Error Handling

**Strategy:** Multi-layered approach with error boundaries and user notifications

**Patterns:**
- Component errors: Try-catch in async operations, SWR error state handling
- Transaction errors: `domain/synthetics/orders/useOrderTxnCallbacks` handles post-transaction errors
- Network errors: Fallback RPC providers via `lib/rpc`
- User errors: Validation in form components, error toasts via `EventToast`
- Contract errors: Custom error decoding in `lib/errors`

## Cross-Cutting Concerns

**Logging:**
- Console logging with `lib/logging.ts` utilities
- Metrics event emission via `lib/metrics/emitMetricEvent.ts`

**Validation:**
- Form input validation in component handlers
- Contract call parameter validation in SDK modules
- Big number validation and formatting in `lib/numbers/`

**Authentication:**
- Wallet connection via RainbowKit integration in `lib/wallets/WalletProvider.tsx`
- Account selection in components, propagated through context
- Signer management in `SyntheticsStateContext`

**Internationalization:**
- Lingui for i18n setup in `src/App/App.tsx`
- Message extraction during build via `yarn lingui:generate`
- Language selection stored in localStorage

**Performance:**
- Code splitting by route via lazy() in MainRoutes
- Bundle analysis with vite-bundle-analyzer
- Memoization of context values to prevent unnecessary renders
- SWR caching and revalidation strategies

---

*Architecture analysis: 2026-02-20*
