import { type Address, zeroAddress } from "viem";

import { ContractsChainId, BASE_SEPOLIA, LOCALHOST } from "./chains";

export const CONTRACTS = {
  [BASE_SEPOLIA]: {
    // Redeployed May 2026 with leverage ladder
    DataStore: "0x3B9d71B497aD2d3c32a7c24e96565f84a58089a7",
    EventEmitter: "0xd5aAfa71f745645Db84cB4877873701ddAf2514c",
    SubaccountRouter: "0x75069f9E4F161Ea04c323CBD2c325728B8b65967",
    ExchangeRouter: "0x7B1687D038396A57A1950693632bAcb249BD64A6",
    DepositVault: "0x4AFE24c4e2477F54aFa4bF30d6D7385e588dfeC4",
    WithdrawalVault: "0x64D496E867000875Dd19C808592fAB6Fc99cBE7F",
    OrderVault: "0x18916C70dFEb3fA3366089d35464aC40f5a1D903",
    ShiftVault: "0xEB15262f24c0AdB52FaB1E496fDf8730B0195cD7",

    SyntheticsReader: "0xe4716038f45bA792123C64B227727E86791bcc62",
    SyntheticsRouter: "0x33153255bed0219b571483e6a0801Fa0B916f7D7",

    GlvReader: "0x5A442F98743659124476aAD8de6A8c37a6a99b7E",
    GlvRouter: "0x48Ac47276C594146339F17508D2Dc1E3236652aF",
    GlvVault: "0xC90Db83d377B91b20f7Ce140673f4C3f24bB2e71",

    GelatoRelayRouter: "0x4040014Af824f606F7E830E3F45370AEf0fCE776",
    SubaccountGelatoRelayRouter: "0x0B851E6F264a180E5D00530E08DC6a016698A84a",

    MultichainClaimsRouter: zeroAddress,
    MultichainGlvRouter: zeroAddress,
    MultichainGmRouter: zeroAddress,
    MultichainOrderRouter: zeroAddress,
    MultichainSubaccountRouter: zeroAddress,
    MultichainTransferRouter: zeroAddress,
    MultichainVault: zeroAddress,
    LayerZeroProvider: zeroAddress,

    ChainlinkPriceFeedProvider: "0x62a2ff1cDFDB0364825F37563769DA0171fA5c1E",
    ClaimHandler: zeroAddress,

    // External
    ExternalHandler: "0x0A9369A2453BC12c1be38DB664B9406981c46C8f",
    OpenOceanRouter: zeroAddress,
    Multicall: "0x295B86560221c6cb2Bed126Cf6D69cC6aC03e0C4",
    LayerZeroEndpoint: zeroAddress,
    ArbitrumNodeInterface: zeroAddress,
    GelatoRelayAddress: zeroAddress,

    // V1 legacy (not deployed on Base Sepolia)
    Vault: zeroAddress,
    Reader: "0xe4716038f45bA792123C64B227727E86791bcc62",
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
    GovToken: "0x8430dE0bAD0f2F58B56304ef708d934dFB8aeF3F",
    ES_GMX_IOU: zeroAddress,
    OrderBook: zeroAddress,
    UniswapGmxEthPool: zeroAddress,
    Timelock: "0x40c6339E499DD2BAe91cc1cae740B64E2EAF6A15",

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
