import { type Address, zeroAddress } from "viem";

import { ContractsChainId, BASE_SEPOLIA, LOCALHOST } from "./chains";

export const CONTRACTS = {
  [BASE_SEPOLIA]: {
    // Synthetics - Updated to match deployed contracts (Jan 2025)
    DataStore: "0xBaD049d5FedE7Bd9022F7E750B982349fE17e83E",
    EventEmitter: "0x1E4cBc2ea12B190D6222D568151b5e708e1477F8",
    SubaccountRouter: "0x733FC820632de04Ff901E2664d208401c4E71A6e",
    ExchangeRouter: "0xAf0BD41cf8376bB1084774bf81804faf7Ba9dE46",
    DepositVault: "0xAeDAad1F7acB0D1b1e1775cEde4606d617d75DCd",
    WithdrawalVault: "0x88f6B6e498720594D21B9a3E2dc3A4CbF35C1ed6",
    OrderVault: "0xF4c5C6C21baeB725AA87bb708e1e3Cc9c2495da7",
    ShiftVault: "0xbDE46443061949B7ce0e534A3BC53A1E98BaD745",

    SyntheticsReader: "0xb53122a72ceA22F71Cf75dc70A2Ed2526246253c",
    SyntheticsRouter: "0x189D42feB4F7238d3B908eD3B45aBc69A43c9bED",

    GlvReader: "0x838a9822868ddAF0951e2474c575b8632835776A",
    GlvRouter: "0xEf4cB87df8050cD98237aF174F4b7972972a114F",
    GlvVault: "0x1c1427d9B8a6C3B419f686A070F4612689B276f7",

    GelatoRelayRouter: "0xeFa1Af575d9Fe55c71CE83f5D03B075bf62a60Ef",
    SubaccountGelatoRelayRouter: "0xba091449600a69fC351F50988B22679ADeB63F28",

    MultichainClaimsRouter: zeroAddress,
    MultichainGlvRouter: zeroAddress,
    MultichainGmRouter: zeroAddress,
    MultichainOrderRouter: zeroAddress,
    MultichainSubaccountRouter: zeroAddress,
    MultichainTransferRouter: zeroAddress,
    MultichainVault: zeroAddress,
    LayerZeroProvider: zeroAddress,

    ChainlinkPriceFeedProvider: "0xA861Ea7fEc99F19C5fD9872679CeDb965d80c391",
    ClaimHandler: zeroAddress,

    // External
    ExternalHandler: "0xd56529c954f29620DAA2dB23F4dB45506254A2b0",
    OpenOceanRouter: zeroAddress,
    Multicall: "0x922ac746Eda42e1ce6989e5B964638C96dc753c7",
    LayerZeroEndpoint: zeroAddress,
    ArbitrumNodeInterface: zeroAddress,
    GelatoRelayAddress: zeroAddress,

    // V1 legacy (not deployed on Base Sepolia)
    Vault: zeroAddress,
    Reader: "0xb53122a72ceA22F71Cf75dc70A2Ed2526246253c",
    PositionRouter: zeroAddress,
    ReferralStorage: "0x38D58E8AFd79F4EcEF1414252fc0bB0151a4FD30",
    VaultReader: zeroAddress,
    GlpManager: zeroAddress,
    RewardRouter: zeroAddress,
    RewardReader: zeroAddress,
    GlpRewardRouter: zeroAddress,
    StakedGmxTracker: zeroAddress,
    FeeGmxTracker: zeroAddress,
    GLP: zeroAddress,
    GMX: zeroAddress,
    ES_GMX: zeroAddress,
    BN_GMX: zeroAddress,
    USDG: zeroAddress,
    BonusGmxTracker: zeroAddress,
    StakedGlpTracker: zeroAddress,
    FeeGlpTracker: zeroAddress,
    ExtendedGmxTracker: zeroAddress,
    StakedGmxDistributor: zeroAddress,
    StakedGlpDistributor: zeroAddress,
    GmxVester: zeroAddress,
    GlpVester: zeroAddress,
    AffiliateVester: zeroAddress,
    Router: "0x189D42feB4F7238d3B908eD3B45aBc69A43c9bED",
    GovToken: "0x9e3C8a704e31df4D79672b30706BD2587461b256",
    ES_GMX_IOU: zeroAddress,
    OrderBook: zeroAddress,
    UniswapGmxEthPool: zeroAddress,
    Timelock: "0xc59f83749Ab34e45a2b29fbd533266E3d7209FE5",

    // BASE_SEPOLIA specific tokens
    NATIVE_TOKEN: "0x4200000000000000000000000000000000000006",
  },
  [LOCALHOST]: {
    DataStore: zeroAddress,
    EventEmitter: zeroAddress,
    SubaccountRouter: zeroAddress,
    ExchangeRouter: zeroAddress,
    DepositVault: zeroAddress,
    WithdrawalVault: zeroAddress,
    OrderVault: zeroAddress,
    ShiftVault: zeroAddress,
    SyntheticsReader: zeroAddress,
    SyntheticsRouter: zeroAddress,
    GlvReader: zeroAddress,
    GlvRouter: zeroAddress,
    GlvVault: zeroAddress,
    GelatoRelayRouter: zeroAddress,
    SubaccountGelatoRelayRouter: zeroAddress,
    MultichainClaimsRouter: zeroAddress,
    MultichainGlvRouter: zeroAddress,
    MultichainGmRouter: zeroAddress,
    MultichainOrderRouter: zeroAddress,
    MultichainSubaccountRouter: zeroAddress,
    MultichainTransferRouter: zeroAddress,
    MultichainVault: zeroAddress,
    LayerZeroProvider: zeroAddress,
    ChainlinkPriceFeedProvider: zeroAddress,
    ClaimHandler: zeroAddress,
    ExternalHandler: zeroAddress,
    OpenOceanRouter: zeroAddress,
    Multicall: zeroAddress,
    LayerZeroEndpoint: zeroAddress,
    ArbitrumNodeInterface: zeroAddress,
    GelatoRelayAddress: zeroAddress,
    Vault: zeroAddress,
    Reader: zeroAddress,
    PositionRouter: zeroAddress,
    ReferralStorage: zeroAddress,
    VaultReader: zeroAddress,
    GlpManager: zeroAddress,
    RewardRouter: zeroAddress,
    RewardReader: zeroAddress,
    GlpRewardRouter: zeroAddress,
    StakedGmxTracker: zeroAddress,
    FeeGmxTracker: zeroAddress,
    GLP: zeroAddress,
    GMX: zeroAddress,
    ES_GMX: zeroAddress,
    BN_GMX: zeroAddress,
    USDG: zeroAddress,
    BonusGmxTracker: zeroAddress,
    StakedGlpTracker: zeroAddress,
    FeeGlpTracker: zeroAddress,
    ExtendedGmxTracker: zeroAddress,
    StakedGmxDistributor: zeroAddress,
    StakedGlpDistributor: zeroAddress,
    GmxVester: zeroAddress,
    GlpVester: zeroAddress,
    AffiliateVester: zeroAddress,
    Router: zeroAddress,
    GovToken: zeroAddress,
    ES_GMX_IOU: zeroAddress,
    OrderBook: zeroAddress,
    UniswapGmxEthPool: zeroAddress,
    Timelock: zeroAddress,
    NATIVE_TOKEN: "0x4200000000000000000000000000000000000006",
  },
};

type ExtractContractNames<T extends object> = {
  [K in keyof T]: keyof T[K];
}[keyof T];

export type ContractName = ExtractContractNames<typeof CONTRACTS>;

export function getContract(chainId: ContractsChainId, name: ContractName): Address {
  if (!CONTRACTS[chainId]) {
    throw new Error(`Unknown chainId ${chainId}`);
  }

  if (!CONTRACTS[chainId][name]) {
    throw new Error(`Unknown contract "${name}" for chainId ${chainId}`);
  }

  return CONTRACTS[chainId][name] as Address;
}
