// Contract addresses for different networks
export const CONTRACT_ADDRESSES = {
  local: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // from deployments/local.json
  // TODO: put base sepolia contract here after deployed
} as const;

// Openfront contract ABI
export const OPENFRONT_ABI = [
  {
    type: "constructor",
    inputs: [{ name: "_gameServer", type: "address", internalType: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimPrize",
    inputs: [{ name: "lobbyId", type: "bytes32", internalType: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createLobby",
    inputs: [
      { name: "lobbyId", type: "bytes32", internalType: "bytes32" },
      { name: "betAmount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "declareWinner",
    inputs: [
      { name: "lobbyId", type: "bytes32", internalType: "bytes32" },
      { name: "winner", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "gameServer",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLobby",
    inputs: [{ name: "lobbyId", type: "bytes32", internalType: "bytes32" }],
    outputs: [
      { name: "host", type: "address", internalType: "address" },
      { name: "betAmount", type: "uint256", internalType: "uint256" },
      { name: "participants", type: "address[]", internalType: "address[]" },
      {
        name: "status",
        type: "uint8",
        internalType: "enum Openfront.GameStatus",
      },
      { name: "winner", type: "address", internalType: "address" },
      { name: "totalPrize", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getParticipantCount",
    inputs: [{ name: "lobbyId", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isParticipant",
    inputs: [
      { name: "lobbyId", type: "bytes32", internalType: "bytes32" },
      { name: "participant", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "joinLobby",
    inputs: [{ name: "lobbyId", type: "bytes32", internalType: "bytes32" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "lobbies",
    inputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    outputs: [
      { name: "host", type: "address", internalType: "address" },
      { name: "betAmount", type: "uint256", internalType: "uint256" },
      {
        name: "status",
        type: "uint8",
        internalType: "enum Openfront.GameStatus",
      },
      { name: "winner", type: "address", internalType: "address" },
      { name: "totalPrize", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setGameServer",
    inputs: [{ name: "_gameServer", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "startGame",
    inputs: [{ name: "lobbyId", type: "bytes32", internalType: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "GameFinished",
    inputs: [
      {
        name: "lobbyId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "winner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "GameStarted",
    inputs: [
      {
        name: "lobbyId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "LobbyCreated",
    inputs: [
      {
        name: "lobbyId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      { name: "host", type: "address", indexed: true, internalType: "address" },
      {
        name: "betAmount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ParticipantJoined",
    inputs: [
      {
        name: "lobbyId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "participant",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PrizeClaimed",
    inputs: [
      {
        name: "lobbyId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "winner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "GameAlreadyStarted",
    inputs: [],
  },
  {
    type: "error",
    name: "GameNotFinished",
    inputs: [],
  },
  {
    type: "error",
    name: "InsufficientFunds",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidBetAmount",
    inputs: [],
  },
  {
    type: "error",
    name: "LobbyFull",
    inputs: [],
  },
  {
    type: "error",
    name: "LobbyNotFound",
    inputs: [],
  },
  {
    type: "error",
    name: "NotGameServer",
    inputs: [],
  },
  {
    type: "error",
    name: "NotHost",
    inputs: [],
  },
  {
    type: "error",
    name: "NotParticipant",
    inputs: [],
  },
  {
    type: "error",
    name: "NotWinner",
    inputs: [],
  },
  {
    type: "error",
    name: "PrizeAlreadyClaimed",
    inputs: [],
  },
  {
    type: "error",
    name: "ReentrancyGuardReentrantCall",
    inputs: [],
  },
] as const;

// Game status enum mapping
export const GameStatus = {
  Created: 0,
  InProgress: 1,
  Finished: 2,
  Claimed: 3,
} as const;

// Utility function to get contract address for current network
export function getContractAddress(
  network: keyof typeof CONTRACT_ADDRESSES = "local",
): string {
  return CONTRACT_ADDRESSES[network];
}

// Utility function to get the Openfront contract ABI
export function getOpenfrontABI() {
  return OPENFRONT_ABI;
}
