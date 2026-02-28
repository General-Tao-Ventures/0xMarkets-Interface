import {
  encodeFunctionData,
  zeroAddress,
  zeroHash,
  formatUnits,
  type Address,
} from "viem";
import {
  config,
  publicClient,
  walletClient,
  CONTRACTS,
  MARKETS,
  USDC_ADDRESS,
  EXECUTION_FEE,
} from "./config.js";
import { exchangeRouterAbi } from "./abis.js";
import { extractOperationKey, waitForExecution } from "./helpers.js";

// Withdraw collateral from existing LONG position to make it liquidatable
// Position: $4,570 size, $323 collateral, 14x leverage
// Target: withdraw ~$300 to leave ~$23 collateral → ~200x leverage → instantly liquidatable

const WITHDRAW_AMOUNT = 260_000_000n; // 260 USDC (6 decimals) - leave ~$63

async function main() {
  console.log("=== Collateral Withdrawal: Push Position Toward Liquidation ===\n");
  
  const walletAddress = config.walletAddress as Address;
  const market = MARKETS["WETH/USD"];
  
  console.log(`Wallet: ${walletAddress}`);
  console.log(`Market: WETH/USD (${market.market})`);
  console.log(`Withdrawing: ${formatUnits(WITHDRAW_AMOUNT, 6)} USDC collateral`);
  console.log(`This will increase leverage from ~14x to ~200x\n`);

  // MarketDecrease order with 0 size delta = collateral withdrawal only
  const orderParams = {
    addresses: {
      receiver: walletAddress,
      cancellationReceiver: zeroAddress,
      callbackContract: zeroAddress,
      uiFeeReceiver: zeroAddress,
      market: market.market,
      initialCollateralToken: USDC_ADDRESS,
      swapPath: [] as Address[],
    },
    numbers: {
      sizeDeltaUsd: 0n,                         // no size change
      initialCollateralDeltaAmount: WITHDRAW_AMOUNT, // withdraw this much
      triggerPrice: 0n,
      acceptablePrice: 0n,                       // for decrease, 0 = accept any
      executionFee: EXECUTION_FEE,
      callbackGasLimit: 0n,
      minOutputAmount: 0n,
      validFromTime: 0n,
    },
    orderType: 4, // MarketDecrease
    isLong: true,
    shouldUnwrapNativeToken: false,
    decreasePositionSwapType: 0,
    autoCancel: false,
    referralCode: zeroHash,
  };

  const multicallData = [
    encodeFunctionData({
      abi: exchangeRouterAbi,
      functionName: "sendWnt",
      args: [CONTRACTS.OrderVault, EXECUTION_FEE],
    }),
    encodeFunctionData({
      abi: exchangeRouterAbi,
      functionName: "createOrder",
      args: [orderParams],
    }),
  ];

  try {
    const txHash = await walletClient.writeContract({
      address: CONTRACTS.ExchangeRouter,
      abi: exchangeRouterAbi,
      functionName: "multicall",
      args: [multicallData],
      value: EXECUTION_FEE,
      gas: 2_500_000n,
    });

    console.log(`Order TX submitted: ${txHash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`Order TX mined in block ${receipt.blockNumber}`);

    if (receipt.status === "reverted") {
      console.log("Order TX reverted!");
      process.exit(1);
    }

    const operationKey = extractOperationKey(receipt, CONTRACTS.EventEmitter, "Order");
    if (!operationKey) {
      console.log("Could not extract operation key from receipt.");
      process.exit(1);
    }

    console.log(`Operation key: ${operationKey}`);
    console.log("Waiting for order-execution-keeper to execute...");

    const result = await waitForExecution(
      publicClient,
      CONTRACTS.EventEmitter,
      operationKey,
      "Order",
      180_000,
      receipt.blockNumber
    );

    if (result.status === "executed") {
      console.log(`\n=== COLLATERAL WITHDRAWN ===`);
      console.log(`Execution TX: ${result.txHash}`);
      console.log(`Block: ${result.blockNumber}`);
      console.log(`\nPosition should now be near-liquidation.`);
      console.log(`Watch keeper-service logs: tail -f /tmp/keeper-service.log | grep -E "liquidat|execut"`);
    } else if (result.status === "cancelled") {
      console.log(`\nOrder CANCELLED at block ${result.blockNumber}`);
      console.log(`TX: ${result.txHash}`);
      console.log(`The contract may not allow this much withdrawal (would violate min collateral).`);
      console.log(`Try withdrawing less collateral.`);
    } else {
      console.log(`\nTIMEOUT: Keeper did not execute within 180s.`);
    }
  } catch (err) {
    console.error("Error:", (err as Error).message?.slice(0, 500));
    process.exit(1);
  }
}

main().catch(console.error);
