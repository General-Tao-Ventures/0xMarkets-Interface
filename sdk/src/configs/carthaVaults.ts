import { BASE_SEPOLIA, SOURCE_BASE_MAINNET } from "./chainIds";

export type CarthaVaultType = "parent" | "child";
export type CarthaCategory = "crypto" | "currencies" | "commodities";

export interface CarthaVaultConfig {
  address: string;
  name: string;
  symbol: string;
  type: CarthaVaultType;
  category: CarthaCategory;
  parentAddress?: string;
  children?: string[];
}

export const CARTHA_VAULTS: Partial<Record<number, CarthaVaultConfig[]>> = {
  [SOURCE_BASE_MAINNET]: [
    // Parent Vaults
    {
      address: "0x7c5fAc6A0295663686873E418406cf540c45CCF3",
      name: "Cartha Crypto",
      symbol: "ccCRYPTO",
      type: "parent",
      category: "crypto",
      children: [
        "0xD090239EaE0d756726b6afd57E0b23A24FCABe86",
        "0x47EbDBE398733664250356F7F19fd516a5f1Dd0a",
      ],
    },
    {
      address: "0xf69eeDf403C9DB553E1d1DCC29B31d0c3e7c58F3",
      name: "Cartha Currencies",
      symbol: "ccCURR",
      type: "parent",
      category: "currencies",
      children: [
        "0x8AE6DDb449b3D8d1fE961483Fbe1329b5e4cbD86",
        "0x9Eed917485e08FdFee977629bf933E8C0B33e539",
        "0xf2e3f581A7dE8B055c0122E3bFb445A67b485831",
      ],
    },
    {
      address: "0xa265777B6241143C752d37025Bb4dE4B3E311A19",
      name: "Cartha Commodities",
      symbol: "ccCOMM",
      type: "parent",
      category: "commodities",
      children: [
        "0xabc777A16E41CF6E2F02A768D1f9f4d8aa68e58F",
      ],
    },
    // Child Vaults - Crypto
    {
      address: "0xD090239EaE0d756726b6afd57E0b23A24FCABe86",
      name: "Cartha BTC Vault",
      symbol: "cvBTC",
      type: "child",
      category: "crypto",
      parentAddress: "0x7c5fAc6A0295663686873E418406cf540c45CCF3",
    },
    {
      address: "0x47EbDBE398733664250356F7F19fd516a5f1Dd0a",
      name: "Cartha ETH Vault",
      symbol: "cvETH",
      type: "child",
      category: "crypto",
      parentAddress: "0x7c5fAc6A0295663686873E418406cf540c45CCF3",
    },
    // Child Vaults - Currencies
    {
      address: "0x8AE6DDb449b3D8d1fE961483Fbe1329b5e4cbD86",
      name: "Cartha EUR Vault",
      symbol: "cvEUR",
      type: "child",
      category: "currencies",
      parentAddress: "0xf69eeDf403C9DB553E1d1DCC29B31d0c3e7c58F3",
    },
    {
      address: "0x9Eed917485e08FdFee977629bf933E8C0B33e539",
      name: "Cartha GBP Vault",
      symbol: "cvGBP",
      type: "child",
      category: "currencies",
      parentAddress: "0xf69eeDf403C9DB553E1d1DCC29B31d0c3e7c58F3",
    },
    {
      address: "0xf2e3f581A7dE8B055c0122E3bFb445A67b485831",
      name: "Cartha JPY Vault",
      symbol: "cvJPY",
      type: "child",
      category: "currencies",
      parentAddress: "0xf69eeDf403C9DB553E1d1DCC29B31d0c3e7c58F3",
    },
    // Child Vaults - Commodities
    {
      address: "0xabc777A16E41CF6E2F02A768D1f9f4d8aa68e58F",
      name: "Cartha GOLD Vault",
      symbol: "cvGOLD",
      type: "child",
      category: "commodities",
      parentAddress: "0xa265777B6241143C752d37025Bb4dE4B3E311A19",
    },
  ],
  [BASE_SEPOLIA]: [
    // Parent Vaults
    {
      address: "0xEDB576D967d5C8C6644B5C0DB5C15Bd2F4E22cC0",
      name: "Cartha Crypto",
      symbol: "ccCRYPTO",
      type: "parent",
      category: "crypto",
      children: [
        "0x870eb515034fD99C06bF74255E228590F22C8A7C",
        "0x45cf0b6A657488d35CFad375c50299Ff065d2841",
      ],
    },
    {
      address: "0x9b4e33298c200cf0B9cb94E3182bf5e2F73cE24f",
      name: "Cartha Currencies",
      symbol: "ccCURR",
      type: "parent",
      category: "currencies",
      children: [
        "0x2B670773D55Ba59CBdAA70D309C1E1B617dAe79f",
        "0xb333A86a4070969c8b152A5b759E9de393bEb626",
        "0xD5bC078A91c339b0e9fF0aae8cF6Abb6F1485F7A",
      ],
    },
    {
      address: "0x9258007d4aF282fC74DA62a451F3F32c98908467",
      name: "Cartha Commodities",
      symbol: "ccCOMM",
      type: "parent",
      category: "commodities",
      children: [
        "0xF0E46062c5Cb29Ec24A995992B8D74B113a9d930",
      ],
    },
    // Child Vaults - Crypto
    {
      address: "0x870eb515034fD99C06bF74255E228590F22C8A7C",
      name: "Cartha BTC Vault",
      symbol: "cvBTC",
      type: "child",
      category: "crypto",
      parentAddress: "0xEDB576D967d5C8C6644B5C0DB5C15Bd2F4E22cC0",
    },
    {
      address: "0x45cf0b6A657488d35CFad375c50299Ff065d2841",
      name: "Cartha ETH Vault",
      symbol: "cvETH",
      type: "child",
      category: "crypto",
      parentAddress: "0xEDB576D967d5C8C6644B5C0DB5C15Bd2F4E22cC0",
    },
    // Child Vaults - Currencies
    {
      address: "0x2B670773D55Ba59CBdAA70D309C1E1B617dAe79f",
      name: "Cartha EUR Vault",
      symbol: "cvEUR",
      type: "child",
      category: "currencies",
      parentAddress: "0x9b4e33298c200cf0B9cb94E3182bf5e2F73cE24f",
    },
    {
      address: "0xb333A86a4070969c8b152A5b759E9de393bEb626",
      name: "Cartha GBP Vault",
      symbol: "cvGBP",
      type: "child",
      category: "currencies",
      parentAddress: "0x9b4e33298c200cf0B9cb94E3182bf5e2F73cE24f",
    },
    {
      address: "0xD5bC078A91c339b0e9fF0aae8cF6Abb6F1485F7A",
      name: "Cartha JPY Vault",
      symbol: "cvJPY",
      type: "child",
      category: "currencies",
      parentAddress: "0x9b4e33298c200cf0B9cb94E3182bf5e2F73cE24f",
    },
    // Child Vaults - Commodities
    {
      address: "0xF0E46062c5Cb29Ec24A995992B8D74B113a9d930",
      name: "Cartha GOLD Vault",
      symbol: "cvGOLD",
      type: "child",
      category: "commodities",
      parentAddress: "0x9258007d4aF282fC74DA62a451F3F32c98908467",
    },
  ],
};

export function getCarthaVaults(chainId: number): CarthaVaultConfig[] {
  return CARTHA_VAULTS[chainId] ?? [];
}

export function isCarthaVault(chainId: number, address: string): boolean {
  return getCarthaVaults(chainId).some(
    (v) => v.address.toLowerCase() === address.toLowerCase()
  );
}
