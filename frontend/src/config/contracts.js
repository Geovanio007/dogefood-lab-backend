// Smart Contract Addresses on DogeOS Devnet
export const CONTRACT_ADDRESSES = {
  LAB_TOKEN: import.meta.env.VITE_LAB_TOKEN_ADDRESS || '0xc238Ef1C4d4d9109e4d8D0D6BB1eA55bA58861d1',
  DOGEFOOD_NFT: import.meta.env.VITE_DOGEFOOD_NFT_ADDRESS || '0xC8AB737B8baef6f8a33b2720fD20F27F4A54E2C0',
  REWARD_DISTRIBUTOR: import.meta.env.VITE_REWARD_DISTRIBUTOR_ADDRESS || '0x37F20600fd6eF1416ccb1DD20043CCfb4d72ba30',
};

// Network Information
export const DOGEOS_DEVNET = {
  chainId: parseInt(import.meta.env.VITE_DOGEOS_CHAIN_ID) || 221122420,
  name: 'DogeOS Devnet',
  rpcUrl: import.meta.env.VITE_DOGEOS_RPC_URL || 'https://rpc.devnet.doge.xyz',
  blockExplorer: import.meta.env.VITE_DOGEOS_EXPLORER || 'https://blockscout.devnet.doge.xyz',
  symbol: 'DOGE',
};

// Contract ABIs (simplified for essential functions)
export const LAB_TOKEN_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

export const DOGEFOOD_NFT_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "ownerOf",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "to", "type": "address"}],
    "name": "mintTreat",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "to", "type": "address"},
      {"indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256"}
    ],
    "name": "DogeNFTMinted",
    "type": "event"
  }
];

export const REWARD_DISTRIBUTOR_ABI = [
  {
    "inputs": [],
    "name": "currentSeason",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "seasonId", "type": "uint256"},
      {"internalType": "address", "name": "user", "type": "address"}
    ],
    "name": "hasClaimedSeason",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "seasonId", "type": "uint256"},
      {"internalType": "address", "name": "user", "type": "address"}
    ],
    "name": "getClaimedAmount",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// Token Information
export const LAB_TOKEN_INFO = {
  name: 'LAB Token',
  symbol: 'LAB',
  decimals: 18,
  totalSupply: '420000000', // 420M tokens
  allocations: {
    community: '70%', // 294M LAB for rewards
    publicSale: '10%', // 42M LAB
    liquidity: '10%', // 42M LAB
    marketing: '5%', // 21M LAB
    team: '5%', // 21M LAB (vested)
  },
};

export const DOGEFOOD_NFT_INFO = {
  name: 'DogeFood Collection',
  symbol: 'DOGEFOOD',
  maxSupply: 420,
  description: 'Exclusive NFT collection for DogeFood Lab VIP Scientists',
};