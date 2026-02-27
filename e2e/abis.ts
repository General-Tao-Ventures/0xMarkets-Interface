/**
 * Minimal ABIs for E2E tests.
 * Only includes functions/events actually called by tests.
 * All ABIs use `as const` for viem type inference.
 */

// ExchangeRouter ABI -- multicall, sendWnt, sendTokens, createDeposit, createWithdrawal, createOrder
export const exchangeRouterAbi = [
  {
    name: "multicall",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
  {
    name: "sendWnt",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "receiver", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "sendTokens",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "receiver", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "createDeposit",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "receiver", type: "address" },
          { name: "callbackContract", type: "address" },
          { name: "uiFeeReceiver", type: "address" },
          { name: "market", type: "address" },
          { name: "initialLongToken", type: "address" },
          { name: "initialShortToken", type: "address" },
          { name: "longTokenSwapPath", type: "address[]" },
          { name: "shortTokenSwapPath", type: "address[]" },
          { name: "minMarketTokens", type: "uint256" },
          { name: "shouldUnwrapNativeToken", type: "bool" },
          { name: "executionFee", type: "uint256" },
          { name: "callbackGasLimit", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "createWithdrawal",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "receiver", type: "address" },
          { name: "callbackContract", type: "address" },
          { name: "uiFeeReceiver", type: "address" },
          { name: "market", type: "address" },
          { name: "longTokenSwapPath", type: "address[]" },
          { name: "shortTokenSwapPath", type: "address[]" },
          { name: "minLongTokenAmount", type: "uint256" },
          { name: "minShortTokenAmount", type: "uint256" },
          { name: "shouldUnwrapNativeToken", type: "bool" },
          { name: "executionFee", type: "uint256" },
          { name: "callbackGasLimit", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "createOrder",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          {
            name: "addresses",
            type: "tuple",
            components: [
              { name: "receiver", type: "address" },
              { name: "cancellationReceiver", type: "address" },
              { name: "uiFeeReceiver", type: "address" },
              { name: "callbackContract", type: "address" },
              { name: "market", type: "address" },
              { name: "initialCollateralToken", type: "address" },
              { name: "swapPath", type: "address[]" },
            ],
          },
          {
            name: "numbers",
            type: "tuple",
            components: [
              { name: "sizeDeltaUsd", type: "uint256" },
              { name: "triggerPrice", type: "uint256" },
              { name: "acceptablePrice", type: "uint256" },
              { name: "executionFee", type: "uint256" },
              { name: "callbackGasLimit", type: "uint256" },
              { name: "minOutputAmount", type: "uint256" },
              { name: "initialCollateralDeltaAmount", type: "uint256" },
              { name: "validFromTime", type: "uint256" },
            ],
          },
          { name: "orderType", type: "uint8" },
          { name: "isLong", type: "bool" },
          { name: "shouldUnwrapNativeToken", type: "bool" },
          { name: "decreasePositionSwapType", type: "uint8" },
          { name: "autoCancel", type: "bool" },
          { name: "referralCode", type: "bytes32" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

// EventEmitter ABI -- EventLog1 event for execution detection
export const eventEmitterAbi = [
  {
    type: "event",
    name: "EventLog1",
    inputs: [
      { name: "msgSender", type: "address", indexed: true },
      { name: "eventName", type: "string", indexed: false },
      { name: "eventNameHash", type: "string", indexed: true },
      { name: "topic1", type: "bytes32", indexed: true },
      { name: "eventData", type: "bytes", indexed: false },
    ],
  },
] as const;

// ERC20 ABI -- approve, allowance, balanceOf + mint (mUSDC is MintableToken)
export const erc20Abi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "account", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;
