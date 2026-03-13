import { type Address, zeroAddress } from "viem";

import { ContractsChainId, BASE_SEPOLIA, LOCALHOST } from "./chains";

export const CONTRACTS = {
  [BASE_SEPOLIA]: {
    // Synthetics - Redeployed Mar 2026 (v1.13 rebrand)
    DataStore: "0x0cA7D71845cb485B7593bBdCbcac93d82d52d053",
    EventEmitter: "0x68001935Ec7C2e3980f99435db3CabC89dea602B",
    SubaccountRouter: "0xE0b283Aa82c47970472153A139b50B108F6F2357",
    ExchangeRouter: "0x77C655E5E894A1029699Fa8A804f28DFfaF360CE",
    DepositVault: "0x590d1d8e50A3a3d9F3448657D1Cb64D486978781",
    WithdrawalVault: "0xE47130E74CAEd3Cae1Bf2c7e1e0af0B592354b57",
    OrderVault: "0x76DE02F06979a24A87F2cD743Ab533a44EdcFb08",
    ShiftVault: "0xEF60117684991C41dea18de53446c437462d07cc",

    SyntheticsReader: "0x4debCC0Cf123529C2a42beC0F8027B03DB1a8b9e",
    SyntheticsRouter: "0xE92B08345125dc77eB071d1a2D513751C4D22714",

    GlvReader: "0x903B6F1a02DD2eF528E00c5EE66942B2F4593fF1",
    GlvRouter: "0xD2434Ea53F0b46200542d7CE886481D3cd07ACb3",
    GlvVault: "0x5fEb1eF511E953dec5E016bFF32F8987cE6eD33a",

    GelatoRelayRouter: "0x88640FBD9aBfEE38D422B47Cb6Be410515d9C431",
    SubaccountGelatoRelayRouter: "0x9c882295c1E692Ecac7CcAd79A285a3e738ee741",

    MultichainClaimsRouter: zeroAddress,
    MultichainGlvRouter: zeroAddress,
    MultichainGmRouter: zeroAddress,
    MultichainOrderRouter: zeroAddress,
    MultichainSubaccountRouter: zeroAddress,
    MultichainTransferRouter: zeroAddress,
    MultichainVault: zeroAddress,
    LayerZeroProvider: zeroAddress,

    ChainlinkPriceFeedProvider: "0x31060bBaD18D4a13Db2e66eD7b562968e93f1312",
    ClaimHandler: zeroAddress,

    // External
    ExternalHandler: "0xfcD54e4D5ECA91abbB18CA9429369617730F4395",
    OpenOceanRouter: zeroAddress,
    Multicall: "0xdD6E2999d0a882886A50c031c7a117058B4aCB5f",
    LayerZeroEndpoint: zeroAddress,
    ArbitrumNodeInterface: zeroAddress,
    GelatoRelayAddress: zeroAddress,

    // V1 legacy (not deployed on Base Sepolia)
    Vault: zeroAddress,
    Reader: "0x4debCC0Cf123529C2a42beC0F8027B03DB1a8b9e",
    PositionRouter: zeroAddress,
    ReferralStorage: "0x29D5533a26ac87C28972d277CEFf2EC00843c5A7",
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
    Router: "0xE92B08345125dc77eB071d1a2D513751C4D22714",
    GovToken: "0xA24dff4D381f97e9cb4DA7fb7b50505390cda522",
    ES_GMX_IOU: zeroAddress,
    OrderBook: zeroAddress,
    UniswapGmxEthPool: zeroAddress,
    Timelock: "0x461B737B685cd9cF68f9735792d7d0035B7AD68E",

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
