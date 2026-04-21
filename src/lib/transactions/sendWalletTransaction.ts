import { TransactionRequest, TransactionResponse } from "ethers";

import { extendError } from "lib/errors";
import { additionalTxnErrorValidation } from "lib/errors/additionalValidation";
import { estimateGasLimit } from "lib/gas/estimateGasLimit";
import { GasPriceData, getGasPrice } from "lib/gas/gasPrice";
import { getProvider } from "lib/rpc";
import { getTenderlyConfig, simulateCallDataWithTenderly } from "lib/tenderly";
import { WalletSigner } from "lib/wallets";

import { TransactionWaiterResult, TxnCallback, TxnEventBuilder } from "./types";

export type WalletTxnCtx = {};

export type WalletTxnResult = {
  transactionHash: string;
  wait: () => Promise<TransactionWaiterResult>;
};

export async function sendWalletTransaction({
  chainId,
  signer,
  to,
  callData,
  value,
  gasLimit,
  gasPriceData,
  runSimulation,
  nonce,
  msg,
  callback,
}: {
  chainId: number;
  signer: WalletSigner;
  to: string;
  callData: string;
  value?: bigint | number;
  gasLimit?: bigint | number;
  gasPriceData?: GasPriceData;
  nonce?: number | bigint;
  msg?: string;
  runSimulation?: () => Promise<void>;
  callback?: TxnCallback<WalletTxnCtx>;
}) {
  const from = signer.address;
  const eventBuilder = new TxnEventBuilder<WalletTxnCtx>({});

  try {
    const tenderlyConfig = getTenderlyConfig();

    if (tenderlyConfig) {
      await simulateCallDataWithTenderly({
        chainId,
        tenderlyConfig,
        provider: signer.provider!,
        to,
        data: callData,
        from,
        value: value,
        gasLimit: gasLimit,
        gasPriceData: gasPriceData,
        blockNumber: undefined,
        comment: msg,
      });
      return {
        transactionHash: undefined,
        wait: async () => ({
          transactionHash: undefined,
          blockNumber: undefined,
          status: "success",
        }),
      };
    }

    // Estimate gas via our own RPC list instead of the wallet's RPC.
    // Some Base Sepolia wallet RPCs (post-v1 reth nodes) reject
    // eth_estimateGas with `intrinsic gas too high` (-32000) while
    // eth_call against the same node succeeds, which surfaces in
    // ethers v6 as a confusing `missing revert data` CALL_EXCEPTION.
    // Routing estimation through our public/fallback RPC pool, plus a
    // hardcoded ceiling, ensures we always send the tx with a gasLimit
    // so the wallet never re-estimates internally against a broken node.
    const provider = getProvider(undefined, chainId);

    const FALLBACK_GAS_LIMIT = 5_000_000n;

    const gasLimitPromise: Promise<bigint | number> = gasLimit
      ? Promise.resolve(gasLimit)
      : estimateGasLimit(provider, {
          to,
          from,
          data: callData,
          value,
        }).catch(() => FALLBACK_GAS_LIMIT);

    const gasPriceDataPromise = gasPriceData
      ? Promise.resolve(gasPriceData)
      : getGasPrice(provider, chainId).catch(() => undefined);

    const [gasLimitResult, gasPriceDataResult] = await Promise.all([
      gasLimitPromise,
      gasPriceDataPromise,
      runSimulation?.().then(() => callback?.(eventBuilder.Simulated())),
    ]);

    callback?.(eventBuilder.Sending());

    const txnData: TransactionRequest = {
      to,
      data: callData,
      value,
      from,
      nonce: nonce !== undefined ? Number(nonce) : undefined,
      gasLimit: gasLimitResult,
      ...(gasPriceDataResult ?? {}),
    };

    const res = await signer.sendTransaction(txnData).catch((error) => {
      additionalTxnErrorValidation(error, chainId, signer.provider!, txnData);

      throw extendError(error, {
        errorContext: "sending",
      });
    });

    callback?.(
      eventBuilder.Sent({
        type: "wallet",
        transactionHash: res.hash,
      })
    );

    return {
      transactionHash: res.hash,
      wait: makeWalletTxnResultWaiter(res.hash, res),
    };
  } catch (error) {
    callback?.(eventBuilder.Error(error));

    throw error;
  }
}

function makeWalletTxnResultWaiter(hash: string, txn: TransactionResponse) {
  return async () => {
    const receipt = await txn.wait();
    return {
      transactionHash: hash,
      blockNumber: receipt?.blockNumber,
      status: receipt?.status === 1 ? "success" : "failed",
    };
  };
}
