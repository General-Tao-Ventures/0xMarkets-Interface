import { formatUnits, keccak256, encodeAbiParameters } from "viem";
import { publicClient, CONTRACTS, MARKETS, USDC_ADDRESS } from "./config.js";

// GMX DataStore uses two-level key: hashString(name) -> bytes32, then hashData(bytes32, ...)
function hashString(name: string): `0x${string}` {
  return keccak256(encodeAbiParameters([{ type: "string" }], [name]));
}

function poolAmountKey(market: `0x${string}`, token: `0x${string}`): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "address" }, { type: "address" }],
      [hashString("POOL_AMOUNT"), market, token]
    )
  );
}

function openInterestKey(market: `0x${string}`, token: `0x${string}`, isLong: boolean): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "address" }, { type: "address" }, { type: "bool" }],
      [hashString("OPEN_INTEREST"), market, token, isLong]
    )
  );
}

const getUintAbi = [
  {
    type: "function" as const,
    name: "getUint" as const,
    inputs: [{ type: "bytes32" as const }],
    outputs: [{ type: "uint256" as const }],
    stateMutability: "view" as const,
  },
];

async function main() {
  const market = MARKETS["WETH/USD"].market;

  const pool = await publicClient.readContract({
    address: CONTRACTS.DataStore,
    abi: getUintAbi,
    functionName: "getUint",
    args: [poolAmountKey(market, USDC_ADDRESS)],
  });
  console.log("Pool USDC (POOL_AMOUNT):", formatUnits(pool, 6));

  const oiLong = await publicClient.readContract({
    address: CONTRACTS.DataStore,
    abi: getUintAbi,
    functionName: "getUint",
    args: [openInterestKey(market, USDC_ADDRESS, true)],
  });
  console.log("OI Long:", formatUnits(oiLong, 30));

  const oiShort = await publicClient.readContract({
    address: CONTRACTS.DataStore,
    abi: getUintAbi,
    functionName: "getUint",
    args: [openInterestKey(market, USDC_ADDRESS, false)],
  });
  console.log("OI Short:", formatUnits(oiShort, 30));

  const amount = Number(formatUnits(pool, 6));
  if (amount < 5000) {
    console.error("FAIL: Pool has less than 5000 USDC");
    process.exit(1);
  }
  console.log("PASS: Pool has sufficient liquidity");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
