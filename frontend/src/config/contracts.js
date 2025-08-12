// Smart Contract Addresses on DogeOS Devnet
export const CONTRACT_ADDRESSES = {
  LAB_TOKEN: import.meta.env.VITE_LAB_TOKEN_ADDRESS || '0xc238Ef1C4d4d9109e4d8D0D6BB1eA55bA58861d1',
  DOGEFOOD_NFT: import.meta.env.VITE_DOGEFOOD_NFT_ADDRESS || '0xC8AB737B8baef6f8a33b2720fD20F27F4A54E2C0',
  REWARD_DISTRIBUTOR: '0x37F20600fd6eF1416ccb1DD20043CCFb4d72ba30',
};

// Network Information
export const DOGEOS_DEVNET = {
  chainId: 221122420,
  name: 'DogeOS Devnet',
  rpcUrl: 'https://rpc.devnet.doge.xyz',
  blockExplorer: 'https://blockscout.devnet.doge.xyz',
  symbol: 'DOGE',
};

// Contract ABIs (simplified for essential functions)
export const LAB_TOKEN_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
];

export const DOGEFOOD_NFT_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
];

export const REWARD_DISTRIBUTOR_ABI = [
  'function currentSeason() view returns (uint256)',
  'function hasClaimedSeason(uint256 seasonId, address user) view returns (bool)',
  'function getClaimedAmount(uint256 seasonId, address user) view returns (uint256)',
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