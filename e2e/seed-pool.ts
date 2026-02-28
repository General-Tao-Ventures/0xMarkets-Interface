import { encodeFunctionData, zeroAddress, formatUnits, formatEther, type Address } from "viem";
import { config, publicClient, walletClient, CONTRACTS, MARKETS, USDC_ADDRESS, EXECUTION_FEE } from "./config.js";
import { exchangeRouterAbi, erc20Abi } from "./abis.js";
import { ensureApprovals, extractOperationKey, waitForExecution } from "./helpers.js";

async function main() {
  const depositAmount = 100_000_000n; // 100 USDC each side = 200 total
  const marketAddress = MARKETS["WETH/USD"].market;

  console.log("=== Seed Pool: 200 USDC into WETH/USD ===");
  console.log(`Wallet: ${config.walletAddress}`);

  const bal = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [config.walletAddress as Address],
  });
  console.log(`USDC balance: ${formatUnits(bal, 6)}`);

  await ensureApprovals(walletClient, publicClient, CONTRACTS.SyntheticsRouter);

  const depositParams = {
    receiver: config.walletAddress as Address,
    callbackContract: zeroAddress,
    uiFeeReceiver: zeroAddress,
    market: marketAddress,
    initialLongToken: USDC_ADDRESS,
    initialShortToken: USDC_ADDRESS,
    longTokenSwapPath: [] as Address[],
    shortTokenSwapPath: [] as Address[],
    minMarketTokens: 0n,
    shouldUnwrapNativeToken: false,
    executionFee: EXECUTION_FEE,
    callbackGasLimit: 0n,
  };

  const multicallData = [
    encodeFunctionData({ abi: exchangeRouterAbi, functionName: "sendWnt", args: [CONTRACTS.DepositVault, EXECUTION_FEE] }),
    encodeFunctionData({ abi: exchangeRouterAbi, functionName: "sendTokens", args: [USDC_ADDRESS, CONTRACTS.DepositVault, depositAmount] }),
    encodeFunctionData({ abi: exchangeRouterAbi, functionName: "sendTokens", args: [USDC_ADDRESS, CONTRACTS.DepositVault, depositAmount] }),
    encodeFunctionData({ abi: exchangeRouterAbi, functionName: "createDeposit", args: [depositParams] }),
  ];

  const txHash = await walletClient.writeContract({
    address: CONTRACTS.ExchangeRouter,
    abi: exchangeRouterAbi,
    functionName: "multicall",
    args: [multicallData],
    value: EXECUTION_FEE,
    gas: 2_500_000n,
  });

  console.log(`TX submitted: ${txHash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`TX mined at block ${receipt.blockNumber}`);

  const opKey = extractOperationKey(receipt, CONTRACTS.EventEmitter);
  console.log(`Operation key: ${opKey}`);
  console.log("Waiting for keeper execution...");

  const result = await waitForExecution(publicClient, CONTRACTS.EventEmitter, opKey!, "Deposit", 60_000);
  console.log(`Result: ${result.status}${result.txHash ? " tx: " + result.txHash : ""}`);

  // Check pool after
  const POOL_KEY_USDC = (await import("viem")).keccak256(
    (await import("viem")).encodeAbiParameters(
      [{ type: "string" }, { type: "address" }, { type: "address" }],
      ["POOL_AMOUNT", marketAddress, USDC_ADDRESS]
    )
  );
  const poolAmount = await publicClient.readContract({
    address: CONTRACTS.DataStore,
    abi: [{ type: "function", name: "getUint", inputs: [{ type: "bytes32" }], outputs: [{ type: "uint256" }], stateMutability: "view" }],
    functionName: "getUint",
    args: [POOL_KEY_USDC],
  });
  console.log(`Pool USDC after: ${formatUnits(poolAmount, 6)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
