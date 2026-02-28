import { encodeFunctionData, zeroAddress, formatUnits, formatEther, keccak256, encodeAbiParameters, type Address } from "viem";
import { config, publicClient, walletClient, CONTRACTS, MARKETS, USDC_ADDRESS, EXECUTION_FEE } from "./config.js";
import { exchangeRouterAbi, erc20Abi } from "./abis.js";
import { ensureApprovals, extractOperationKey, waitForExecution } from "./helpers.js";

async function main() {
  const depositAmount = 5_000_000_000n; // 5,000 USDC each side = 10,000 total
  const marketAddress = MARKETS["WETH/USD"].market;

  console.log("=== Seed Pool: 10,000 USDC into WETH/USD ===");
  console.log(`Wallet: ${config.walletAddress}`);

  const bal = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [config.walletAddress as Address],
  });
  console.log(`USDC balance: ${formatUnits(bal, 6)}`);

  // Pre-check: mint USDC if balance < 12,000 (need 10,000 for deposit + buffer)
  const requiredBalance = 12_000_000_000n; // 12,000 USDC
  if (bal < requiredBalance) {
    const mintAmount = 15_000_000_000n; // 15,000 USDC buffer
    console.log(`Balance below 12,000 USDC. Minting ${formatUnits(mintAmount, 6)} USDC...`);
    const mintHash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: [{ name: "mint", type: "function", inputs: [{ type: "address", name: "to" }, { type: "uint256", name: "amount" }], outputs: [], stateMutability: "nonpayable" }],
      functionName: "mint",
      args: [config.walletAddress as Address, mintAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: mintHash });
    const newBal = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [config.walletAddress as Address],
    });
    console.log(`USDC balance after mint: ${formatUnits(newBal, 6)}`);
  }

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
  // GMX DataStore uses two-level key: hashString("POOL_AMOUNT") -> bytes32, then hashData(bytes32, market, token)
  const POOL_AMOUNT_KEY = keccak256(encodeAbiParameters([{ type: "string" }], ["POOL_AMOUNT"]));
  const POOL_KEY_USDC = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "address" }, { type: "address" }],
      [POOL_AMOUNT_KEY, marketAddress, USDC_ADDRESS]
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
