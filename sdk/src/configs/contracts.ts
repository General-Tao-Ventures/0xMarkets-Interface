import { type Address, zeroAddress } from "viem";

import { ContractsChainId, BASE_SEPOLIA, LOCALHOST } from "./chains";

export const CONTRACTS = {
  [BASE_SEPOLIA]: {
    // Synthetics - Updated to match on-chain DataStore (Feb 2026 audit)
    DataStore: "0x3B9d71B497aD2d3c32a7c24e96565f84a58089a7",
    EventEmitter: "0xd5aAfa71f745645Db84cB4877873701ddAf2514c",
    SubaccountRouter: "0x733FC820632de04Ff901E2664d208401c4E71A6e",
    ExchangeRouter: "0xF98622Ff9Dfd6bC7877EB0653cbE1bA7dCC54321",
    DepositVault: "0x4AFE24c4e2477F54aFa4bF30d6D7385e588dfeC4",
    WithdrawalVault: "0x64D496E867000875Dd19C808592fAB6Fc99cBE7F",
    OrderVault: "0x18916C70dFEb3fA3366089d35464aC40f5a1D903",
    ShiftVault: "0xEB15262f24c0AdB52FaB1E496fDf8730B0195cD7",

    SyntheticsReader: "0x1e6Ca8042e7BC258BBbA35C5C86F013b4eceC03C",
    SyntheticsRouter: "0x33153255bed0219b571483e6a0801Fa0B916f7D7",

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
    Reader: "0x1e6Ca8042e7BC258BBbA35C5C86F013b4eceC03C",
    PositionRouter: zeroAddress,
    ReferralStorage: "0xF5F9CdBe6225aBFF7cE2F290d12bc1BaCCC926E2",
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
    Router: "0x33153255bed0219b571483e6a0801Fa0B916f7D7",
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
