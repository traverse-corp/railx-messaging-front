export const RailXVaultAbi = [
  {
    "type": "function",
    "name": "depositLiquidity",
    "inputs": [
      { "name": "token", "type": "address", "internalType": "address" },
      { "name": "amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdrawLiquidity",
    "inputs": [
      { "name": "token", "type": "address", "internalType": "address" },
      { "name": "amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "executeMarketSwap",
    "inputs": [
      { "name": "tradeId", "type": "bytes32", "internalType": "bytes32" },
      { "name": "sender", "type": "address", "internalType": "address" },
      { "name": "recipient", "type": "address", "internalType": "address" },
      { "name": "lp", "type": "address", "internalType": "address" },
      { "name": "tokenIn", "type": "address", "internalType": "address" },
      { "name": "tokenOut", "type": "address" },
      { "name": "amountIn", "type": "uint256", "internalType": "uint256" },
      { "name": "amountOut", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "lpBalances",
    "inputs": [
      { "name": "", "type": "address", "internalType": "address" },
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  }
] as const;