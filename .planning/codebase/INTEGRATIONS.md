# External Integrations

**Analysis Date:** 2026-02-20

## APIs & External Services

**Stats & Pricing:**
- 0xMarkets Stats API - `https://stats.0xmarkets.io/api`
  - Endpoint: `/candles/{symbol}` - Candlestick chart data
  - Client: Fetch API
  - Used in: `src/domain/prices/index.ts`

**Subgraph/Indexing:**
- Subsquid GraphQL API - Base Sepolia event indexing
  - URL: `https://7e27672d-eadb-408b-b9b8-71f30d76effd.squids.live/0xmarkets-base-sepolia@v1/api/graphql`
  - Client: Apollo Client via `lib/subgraph/clients`
  - Chains: Base Sepolia (configurable in `src/config/subgraph.ts`)
  - Used in: GraphQL queries throughout application

**External Swaps:**
- Open Ocean Finance - DEX aggregator
  - Base URL: `https://open-api.openocean.finance/v3`
  - Endpoints: `/swap_quote` - Swap quotes and transaction building
  - Referrer: `0xC539cB358a58aC67185BaAD4d5E3f7fCfc903700`
  - Configuration: `src/config/externalSwaps.ts`
  - Features: Price impact thresholds, disabled DEX support per chain
  - Used in: `src/domain/synthetics/externalSwaps/openOcean.ts`

**Sponsored Transactions:**
- Gelato Network - Transaction relay service
  - SDK: @gelatonetwork/relay-sdk 5.6.0
  - API: `https://api.gelato.digital/1balance/networks/mainnets/sponsors/{sponsorAddress}`
  - Sponsor: `0x88FcCAC36031949001Df4bB0b68CBbd07f033161`
  - Purpose: Check balance and relay transaction execution
  - Feature flagged: `testSponsoredCall`
  - Used in: `src/domain/synthetics/express/useSponsoredCallParamsRequest.ts`

**Cross-Chain Bridging:**
- Stargate Finance - Cross-chain messaging
  - SDK: @stargatefinance/stg-evm-sdk-v2 1.1.12
  - ABI: `node_modules/@stargatefinance/stg-evm-sdk-v2/artifacts/src/interfaces/IStargate.sol/IStargate.json`
  - Used for: Bridge operations and cross-chain swaps

**Chain Utilities:**
- LayerZero - Cross-chain infrastructure
  - SDK: @layerzerolabs/lz-v2-utilities 3.0.85
  - Purpose: Support for cross-chain messaging

## Data Storage

**Databases:**
- None - Application is read-only client-side except for localStorage
- All data sourced from: blockchain (RPC), subgraph (Subsquid), keeper API

**File Storage:**
- None - Purely client-side application
- Contract ABIs stored in: `sdk/src/abis/*.json` (static JSON files)

**Caching:**
- Browser localStorage - Persists user preferences and transaction history
- React Query - In-memory server state caching
- SWR - Lightweight HTTP caching

## Authentication & Identity

**Wallet Connection:**
- Rainbow Kit - @rainbow-me/rainbowkit 2.2.0
  - Provides wallet UI and connection management
  - Supports: MetaMask, Coinbase Wallet, and other connectors
  - Integration: `src/App/App.tsx`

**Auth Provider:**
- Custom wallet-based (no centralized auth)
  - User identity: Ethereum wallet address
  - Signing: ethers.js Signer interface
  - Connection: wagmi hooks

**Blockchain Signing:**
- ethers v6 Signer - For transaction and message signing
- viem `recoverTypedDataAddress` - For EIP-712 typed data verification

## Monitoring & Observability

**Error Tracking:**
- Metrics system - `lib/metrics`
  - Method: `metrics.pushError(error, context)`
  - Used throughout: Open Ocean, Gelato, and other integrations
  - No third-party error tracking vendor detected

**Logs:**
- Console logging with warnings/errors
  - localStorage overrides for development (subgraph URLs)

## CI/CD & Deployment

**Hosting:**
- Netlify - Primary deployment (netlify.toml present)
- Vercel - Secondary option (vercel.json present)

**Build Scripts:**
- `yarn build` - Production build
- `yarn build-app` - App-specific build with production config
- `yarn build-home` - Home/landing page build
- `VITE_APP_VERSION` - Git commit hash injected at build time

**Code Quality:**
- Pre-commit hooks: ESLint + Prettier (via husky/lint-staged)
- CI checks available: `yarn check:ci` (lint + test + tscheck)

## Environment Configuration

**Required env vars for deployment:**
- `VITE_APP_IS_HOME_SITE` - Boolean flag to switch home/app modes
- `.env-cmdrc` profiles:
  - `development` / `development-home` / `development-app`
  - `production-home` / `production-app`

**Development overrides (localStorage):**
- Subgraph URL override by chain (key: `SUBGRAPH_URL_KEY`)
- Server base URL override (key: `SERVER_BASE_URL`)
- Only active in development mode per `isDevelopment()`

**Secrets location:**
- Alchemy API keys embedded in code with domain whitelisting (see `src/config/chains.ts`)
  - Fallback key: `jXT7KIV6ttYFNoSprdkqG`
  - Domain-specific keys for 0xmarkets.io and app.0xmarkets.io
  - Three purposes: fallback, largeAccount, express

## RPC Providers

**Base Sepolia (84532):**
- Primary RPC endpoints:
  - `https://base-sepolia.drpc.org`
  - `https://base-sepolia.publicnode.com`
  - `https://base-sepolia.therpc.io`
  - `https://base-sepolia.rpc.ankr.com`
- Fallback RPC endpoints:
  - `https://sepolia.base.org`
  - `https://base-sepolia-rpc.publicnode.com`
  - Alchemy with fallback key

**Base Mainnet (8453):**
- Primary RPC endpoints:
  - `https://mainnet.base.org`
  - `https://base.llamarpc.com`
  - `https://base-rpc.publicnode.com`
  - `https://base.drpc.org`
- Private/Express endpoints via Alchemy (whitelisted domain only)

**Localhost (development):**
- `http://127.0.0.1:8545` - Local hardhat/anvil node

## Oracle & Price Feeds

**Price Data:**
- Oracle Keeper Service - Local keeper providing price feeds
  - URL: `http://142.93.203.222:37017` (production via `/api/keeper` proxy)
  - Local URL: `http://127.0.0.1:37017`
  - Configuration: `sdk/src/configs/oracleKeeper.ts`
  - Fallback URLs defined per chain

**Chainlink Integration:**
- Subsquid integration for Chainlink feed data (via subgraph client)

## Webhooks & Callbacks

**Incoming:**
- None detected - Application is client-only

**Outgoing:**
- Open Ocean - Swap transaction encoding callback
- Gelato - Relay execution confirmation callbacks (implicit via API polling)

## Backend Services

**Stats Server:**
- URL: Configurable per chain (default: `https://gmx-server-mainnet.uw.r.appspot.com`)
- Development: Overridable via localStorage `SERVER_BASE_URL`
- Used for: Price candles, stats, metrics

**Keeper Service:**
- Provides: Price feeds, liquidation data, order execution data
- Port: 37017
- Both local (for development) and cloud deployment supported
- Frontend depends on keeper for: `getContractMarketPrices()` data

## Token & Contract Configuration

**Token Data:**
- Defined in: `sdk/src/configs/tokens.ts`
- Chain-specific token lists
- Includes: USDC, WETH, synthetic tokens (EUR, GBP, GOLD, JPY)
- Market configuration: `sdk/src/configs/markets.ts`

**Contract Addresses:**
- Generated from SDK configs: `sdk/src/configs/contracts.ts`
- Used via TypeChain: `typechain-types` generated types
- Includes: DataStore, ExchangeRouter, GlvRouter, Multicall, etc.

---

*Integration audit: 2026-02-20*
