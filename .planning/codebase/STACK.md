# Technology Stack

**Analysis Date:** 2026-02-20

## Languages

**Primary:**
- TypeScript 5.4.2 - Main language for all application code
- JavaScript - Configuration and utility scripts

**Secondary:**
- SCSS/SASS 1.55.0 - Styling alongside Tailwind CSS
- GraphQL - Used for subgraph queries (via Apollo Client)

## Runtime

**Environment:**
- Node.js 20 (specified in `.nvmrc`)

**Package Manager:**
- Yarn 4.12.0
- Lockfile: `yarn.lock` present (one in root, one in `sdk/`)

## Frameworks

**Core:**
- React 18.2.0 - Frontend UI framework
- Vite 5.4.0 - Build tool and dev server

**Web3:**
- ethers 6.12.1 - Ethereum library for contract interactions and signing
- viem 2.37.1 - Modern Ethereum client library (co-exists with ethers)
- wagmi 2.12.29 - React hooks for Web3 (wallet connection, contract calls)
- @wagmi/core 2.14.4 - Core hooks library
- @wagmi/connectors 5.3.7 - Wallet connector implementations

**Data Management:**
- @apollo/client 3.5.6 - GraphQL client for subgraph queries
- @tanstack/react-query 5.25.0 - Server state and data fetching
- swr 2.3.3 - Lightweight data fetching library (used alongside React Query)
- reselect 5.1.0 - Redux-style selectors for memoized state
- immer 10.1.1 - Immutable state updates

**UI Components:**
- @headlessui/react 1.7.19 - Unstyled accessible components
- framer-motion 11.1.9 - Animation library
- react-select 5.2.1 - Autocomplete/select component
- react-router-dom 5.3.4 - Routing
- react-tabs 3.2.3 - Tabbed interface
- @floating-ui/react 0.26.19 - Positioning engine for popovers/dropdowns

**Visualization & Data:**
- recharts 2.12.7 - React charting library
- react-calendar 6.0.0 - Calendar component
- react-jazzicon 1.0.4 - Ethereum address avatar

**Utilities:**
- lodash 4.17.21 - Common utility functions (ES6 import preferred, not default)
- date-fns 2.27.0 - Date manipulation
- classnames 2.3.1 - Dynamic CSS class generation
- shallowequal 1.1.0 - Shallow comparison utility
- query-string 7.1.1 - URL query string parsing
- crypto-js 4.2.0 - Cryptography utilities
- hex-to-rgba 2.0.1 - Color conversion

**Internationalization:**
- @lingui/core 4.10.0 - i18n framework core
- @lingui/react 4.10.0 - React bindings for Lingui
- @lingui/macro 4.11.3 - Macro for i18n message extraction
- @lingui/cli 4.10.0 - CLI tools for Lingui

**Testing:**
- Vitest 2.0.5 - Unit test runner
- @vitest/web-worker 2.0.5 - Web Worker testing support
- @testing-library/react 11.2.7 - React component testing utilities
- happy-dom 14.12.3 - Lightweight DOM implementation for tests

**Build & Development:**
- TypeChain 8.3.2 - Generate TypeScript types from contract ABIs
- @typechain/ethers-v6 0.5.1 - TypeChain adapter for ethers v6
- Prettier 3.2.5 - Code formatter
- ESLint 8.41.0 - JavaScript linter
- TailwindCSS 3.4.4 - Utility-first CSS framework

## Key Dependencies

**Critical:**
- ethers 6.12.1 - Primary Ethereum interactions, contract calls, wallet signing
- viem 2.37.1 - Modern alternative/complement to ethers for type-safe chain operations
- wagmi 2.12.29 - React hooks for wallet connections and contract interactions
- @apollo/client 3.5.6 - Subgraph query client (subsquid endpoint)
- Tailwind CSS 3.4.4 - Core styling system

**Infrastructure:**
- @gelatonetwork/relay-sdk 5.6.0 - Relayer for sponsored transactions
- @stargatefinance/stg-evm-sdk-v2 1.1.12 - Cross-chain bridging integration
- @layerzerolabs/lz-v2-utilities 3.0.85 - LayerZero cross-chain utilities
- @uniswap/sdk-core 3.0.1 - Uniswap v3 swap calculations
- @uniswap/v3-sdk 3.9.0 - Uniswap v3 SDK

**Monitoring:**
- web-vitals 1.1.2 - Core Web Vitals metrics
- cross-fetch 4.0.0 - Universal fetch implementation

## Configuration

**Environment:**
- `env-cmd` 10.1.0 - Environment variable management per deployment target
- `.env-cmdrc` - Configuration for development-home, development-app, production-home, production-app
- `VITE_APP_VERSION` - Git commit hash injected at build time
- `VITE_IS_HOME_SITE` - Feature flag for home page vs app

**Build:**
- `vite.config.ts` - Main Vite configuration
- `vite.landing.config.ts` - Separate build config for landing/home page
- `tsconfig.json` - TypeScript configuration (baseUrl: src, strict null checks)
- `tailwind.config.ts` - Tailwind CSS configuration

**SDK:**
- Separate SDK package at `sdk/` with its own `package.json` and build process
- Exports via package.json: `./build/esm`, `./build/cjs`, `./build/types`
- GraphQL codegen for subsquid integration

## Platform Requirements

**Development:**
- Node.js 20+
- Yarn 4.12.0
- ESLint + Prettier for code quality
- Husky + lint-staged for pre-commit hooks

**Production:**
- Modern browsers (ES2020 target)
- Netlify deployment (see `netlify.toml`)
- Vercel also supported (see `vercel.json`)

**Chain Support:**
- Base Sepolia (84532) - Primary testnet
- Base Mainnet (8453) - Production chain (limited features)

---

*Stack analysis: 2026-02-20*
