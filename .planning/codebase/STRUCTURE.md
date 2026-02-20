# Codebase Structure

**Analysis Date:** 2026-02-20

## Directory Layout

```
0xMarkets-Interface/
├── src/                           # Main application source code
│   ├── index.tsx                  # React root entry point
│   ├── App/                       # Application shell and routing
│   ├── pages/                     # Route-level page components
│   ├── components/                # Reusable UI components
│   ├── context/                   # React Context providers for state
│   ├── domain/                    # Business logic and feature modules
│   ├── lib/                       # Utility functions and infrastructure
│   ├── config/                    # Application configuration
│   ├── styles/                    # Global CSS and SCSS stylesheets
│   ├── fonts/                     # Font files and CSS
│   ├── img/                       # Static images and icons
│   ├── locales/                   # i18n translation files
│   ├── typechain-types/           # Generated contract types
│   ├── prebuilt/                  # Precompiled artifacts
│   └── ab/                        # A/B testing configuration
├── sdk/                           # Blockchain SDK and contract interactions
│   └── src/
│       ├── configs/               # Chain, token, contract configurations
│       ├── modules/               # SDK modules for Markets, Orders, Positions, etc.
│       ├── utils/                 # Utility functions (multicall, serialization)
│       ├── types/                 # TypeScript type definitions
│       ├── abis/                  # Smart contract ABIs (JSON)
│       └── index.ts               # SDK main entry point
├── index.html                     # HTML template entry point
├── vite.config.ts                 # Vite build configuration
├── tsconfig.json                  # TypeScript configuration
├── package.json                   # Dependencies and scripts
└── .planning/codebase/            # GSD analysis documents (this file)
```

## Directory Purposes

**src/App:**
- Purpose: Application bootstrap, routing, and global layout
- Contains: App.tsx (context setup), AppRoutes.tsx (URL routing), MainRoutes.tsx (route definitions), swrConfig.tsx (SWR defaults)
- Key files: `src/App/App.tsx`, `src/App/AppRoutes.tsx`, `src/App/MainRoutes.tsx`

**src/pages:**
- Purpose: Top-level page components matched by router
- Contains: Feature page components organized by route name
- Key files: `src/pages/SyntheticsPage/SyntheticsPage.tsx` (main trading page), `src/pages/Pools/Pools.tsx`, `src/pages/AccountDashboard/AccountDashboard.tsx`

**src/components:**
- Purpose: Reusable UI components
- Contains: 200+ components organized by feature/domain
- Key subdirectories:
  - `TradeBox/`: Trading interface
  - `OrderEditor/`, `OrderList/`, `OrderItem/`: Order management
  - `PositionEditor/`, `PositionSeller/`, `PositionList/`, `PositionItem/`: Position management
  - `SwapCard/`: Token swap UI
  - `TVChart/`: TradingView chart integration
  - `Modal/`, `ModalViews/`: Modal dialogs
  - `Header/`, `SideNav/`, `Footer/`: Layout components

**src/context:**
- Purpose: React Context providers for application state
- Contains: Specialized context modules
- Key directories:
  - `SyntheticsStateContext/`: Main state (markets, orders, positions, tokens)
  - `ChainContext/`: Current chain and account
  - `GlobalContext/`: App-level settings
  - `SettingsContext/`: User preferences
  - `SubaccountContext/`: Subaccount management
  - `TokensBalancesContext/`: Token balance tracking
  - `WebsocketContext/`: Real-time connections
  - `PendingTxnsContext/`: Transaction tracking

**src/domain:**
- Purpose: Feature-specific business logic
- Contains: Subdomains organized by feature
- Key directories:
  - `synthetics/`: Core trading functionality (1000+ files)
    - `markets/`: Market data and calculations
    - `orders/`: Order creation and management
    - `positions/`: Position tracking
    - `accountStats/`: Performance analytics
    - `express/`: Express trading mode
    - `externalSwaps/`: External swap routing
    - `trade/`: Trade state and execution
  - `multichain/`: Cross-chain operations
  - `tokens/`: Token management and validation
  - `prices/`: Price feeds and calculations
  - `stats/`: Statistics and analytics
  - `referrals/`: Referral program

**src/lib:**
- Purpose: Reusable utilities and infrastructure
- Contains: Helper functions and integrations
- Key subdirectories:
  - `chains/`: Chain utilities (chainId, network switching)
  - `wallets/`: Web3 integration (RainbowKit, wagmi, ethers)
  - `contracts/`: Contract interaction helpers
  - `multicall/`: Batch contract reads
  - `rpc/`: RPC provider management with fallbacks
  - `subgraph/`: GraphQL queries to subgraph
  - `metrics/`: Analytics and performance tracking
  - `numbers/`: Number formatting and BigNumber utilities
  - `localStorage/`: Persistent state helpers
  - `errors/`: Error types and decoding

**src/config:**
- Purpose: Application-wide configuration
- Contains: Constants and settings
- Key files:
  - `chains.ts`: Chain configurations, RPC providers, network constants
  - `contracts.ts`: Contract addresses (moved from here to SDK)
  - `markets.ts`: Market configuration
  - `tokens.ts`: Token metadata
  - `localStorage.ts`: All localStorage key constants
  - `ui.ts`: UI constants (timeouts, toast timing)
  - `externalSwaps.ts`: External swap service configuration
  - `multichain.ts`: Cross-chain settings
  - `static/`: Generated/prebuilt config files

**src/styles:**
- Purpose: Global stylesheets
- Contains: SCSS and CSS files
- Key files: `Shared.scss` (resets, utilities), `Input.css`, `recharts.css`

**sdk/src:**
- Purpose: Blockchain SDK abstraction layer
- Contains: Object-oriented interface to contracts
- Key subdirectories:
  - `modules/`: SDK modules implementing contract interactions
    - `markets/`: Market contract queries
    - `orders/`: Order creation and execution
    - `positions/`: Position reading and updates
    - `trades/`: Trade execution
    - `tokens/`: Token operations
    - `accounts/`: Account data
    - `utils/`: Utility operations
  - `configs/`: Configuration data
    - `chains.ts`: Chain definitions
    - `tokens.ts`: Token metadata and validation
    - `contracts.ts`: Contract addresses
  - `utils/`: Internal SDK utilities
    - `multicall.ts`: Batch contract calls
    - `callContract.ts`: Contract method calling
  - `types/`: TypeScript interfaces for all data structures
  - `abis/`: Contract ABIs (generated from contracts)

## Key File Locations

**Entry Points:**
- `src/index.tsx`: React root, mounts App to DOM
- `index.html`: HTML template with root div and script references

**Configuration:**
- `src/config/chains.ts`: Chain and RPC configuration
- `src/config/localStorage.ts`: All localStorage key constants
- `src/config/multichain.ts`: Cross-chain settings
- `src/config/markets.ts`: Market list and metadata
- `sdk/src/configs/tokens.ts`: Token definitions (USDC, WETH, synthetic tokens)

**Core Logic:**
- `src/context/SyntheticsStateContext/SyntheticsStateContextProvider.tsx`: Main state setup
- `src/context/SyntheticsStateContext/selectors/`: State selectors for components
- `src/domain/synthetics/markets/useMarketsInfoRequest/`: Market data fetching
- `src/domain/synthetics/orders/`: Order creation and execution
- `src/lib/wallets/WalletProvider.tsx`: Wallet connection setup

**Testing:**
- `src/lib/__tests__/`: Utility tests
- `src/domain/multichain/__tests__/`: Feature tests
- `vitest.config.ts`: Test runner configuration

## Naming Conventions

**Files:**
- Components: PascalCase.tsx (e.g., `TradeBox.tsx`)
- Hooks (custom): camelCase.ts, prefixed with `use` (e.g., `useTradeboxState.ts`)
- Utilities: camelCase.ts (e.g., `formatting.ts`)
- Selectors: camelCase.ts or directoryName with selector functions inside (e.g., `tradeboxSelectors.ts`)
- Types/Constants: SCREAMING_SNAKE_CASE for constants, PascalCase for types (e.g., `TRADE_BOX_HEIGHT`, `TradeBoxState`)
- Tests: Same name as file being tested, with `.spec.ts` or `.test.ts` suffix

**Directories:**
- Feature directories: PascalCase (e.g., `TradeBox/`)
- Utility directories: camelCase (e.g., `utils/`, `lib/`)
- Domain subdomains: camelCase (e.g., `synthetics/`, `multichain/`)
- Context directories: PascalCase (e.g., `SyntheticsStateContext/`)

**Functions & Variables:**
- Functions: camelCase (e.g., `getTradeboxState()`)
- Component props: camelCase with descriptive names
- Event handlers: `handle` + action (e.g., `handleOrderSubmit()`)
- Selectors: `select` + noun (e.g., `selectTradeboxState()`)
- State setters: `set` + noun (e.g., `setTradeboxState()`)
- Boolean values/functions: `is`/`has`/`can` prefix (e.g., `isLoading`, `hasError`, `canExecute`)

## Where to Add New Code

**New Feature Module:**
- Create in `src/domain/[featureName]/`
- Add request hooks in `src/domain/[featureName]/use*Request.ts`
- Add selectors in `src/domain/[featureName]/selectors.ts` if needs state
- Add types in `sdk/src/types/` if blockchain-related
- Export from domain index for use in context

**New Page:**
- Create directory in `src/pages/[PageName]/`
- Add main component `src/pages/[PageName]/[PageName].tsx`
- Add route in `src/App/MainRoutes.tsx`
- Wrap with context provider if needed (usually `SyntheticsStateContextProvider`)

**New Component:**
- Create directory in `src/components/[ComponentName]/`
- Add component file `src/components/[ComponentName]/[ComponentName].tsx`
- Add styles in `src/components/[ComponentName]/[ComponentName].scss` (if using SCSS)
- Add tests in `src/components/[ComponentName]/[ComponentName].spec.tsx`
- Export from component directory via index (optional)

**New Context:**
- Create directory in `src/context/[ContextName]/`
- Create provider file `src/context/[ContextName]/[ContextName]Provider.tsx`
- Create hooks file if multiple hooks needed
- Export both context and hooks from directory

**New Utility:**
- Add to appropriate `src/lib/[category]/` directory
- If creates new category, create new directory
- Export from category index file

**SDK Extension:**
- Add methods to appropriate module in `sdk/src/modules/`
- Add types to `sdk/src/types/`
- Add ABI to `sdk/src/abis/` if new contract

## Special Directories

**src/locales/:**
- Purpose: i18n translation files
- Generated: Yes (by Lingui during build)
- Committed: Yes (translation catalogs)
- Files: language directories (en/, de/, ja/, etc.) with .po files

**src/typechain-types/:**
- Purpose: TypeScript types generated from contract ABIs
- Generated: Yes (by typechain during postinstall)
- Committed: Yes
- Files: Auto-generated contract interface definitions

**src/prebuilt/:**
- Purpose: Pre-built or cached artifacts
- Generated: Yes (generated during build)
- Committed: Yes

**src/ab/:**
- Purpose: A/B testing feature flags
- Generated: No
- Committed: Yes
- Files: Feature flag definitions and utils

**build/:**
- Purpose: Production build output
- Generated: Yes (by Vite)
- Committed: No
- Created by: `yarn build`

**.vercel/:**
- Purpose: Vercel deployment configuration
- Generated: Partially (some files auto-generated)
- Committed: Yes (project config)

---

*Structure analysis: 2026-02-20*
