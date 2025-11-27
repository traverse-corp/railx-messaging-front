export const RailXCompliance721Abi = [
  {
    "type": "function",
    "name": "mintComplianceRecord",
    "inputs": [
      { "name": "to", "type": "address", "internalType": "address" },
      { "name": "uri", "type": "string", "internalType": "string" },
      { "name": "relatedTxHash", "type": "string", "internalType": "string" }
    ],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "ComplianceRecordMinted",
    "inputs": [
      { "name": "tokenId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "sender", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "receiver", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "relatedTxHash", "type": "string", "indexed": false, "internalType": "string" },
      { "name": "metadataUri", "type": "string", "indexed": false, "internalType": "string" }
    ],
    "anonymous": false
  }
] as const;