import { createPublicClient, http, formatUnits } from 'viem';
import { dogeOSDevnet } from '../config/wagmi';
import { 
  CONTRACT_ADDRESSES, 
  LAB_TOKEN_ABI, 
  DOGEFOOD_NFT_ABI, 
  REWARD_DISTRIBUTOR_ABI 
} from '../config/contracts';

// Create public client for reading blockchain data
const publicClient = createPublicClient({
  chain: dogeOSDevnet,
  transport: http()
});

export class BlockchainService {
  constructor() {
    this.client = publicClient;
  }

  // LAB Token Functions
  async getLabBalance(address) {
    try {
      const balance = await this.client.readContract({
        address: CONTRACT_ADDRESSES.LAB_TOKEN,
        abi: LAB_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [address]
      });
      
      // Convert from wei to LAB tokens (18 decimals)
      return formatUnits(balance, 18);
    } catch (error) {
      console.error('Error getting LAB balance:', error);
      return '0';
    }
  }

  async getLabTokenInfo() {
    try {
      const [symbol, decimals, totalSupply] = await Promise.all([
        this.client.readContract({
          address: CONTRACT_ADDRESSES.LAB_TOKEN,
          abi: LAB_TOKEN_ABI,
          functionName: 'symbol'
        }),
        this.client.readContract({
          address: CONTRACT_ADDRESSES.LAB_TOKEN,
          abi: LAB_TOKEN_ABI,
          functionName: 'decimals'
        }),
        this.client.readContract({
          address: CONTRACT_ADDRESSES.LAB_TOKEN,
          abi: LAB_TOKEN_ABI,
          functionName: 'totalSupply'
        })
      ]);

      return {
        symbol,
        decimals,
        totalSupply: formatUnits(totalSupply, decimals),
        address: CONTRACT_ADDRESSES.LAB_TOKEN
      };
    } catch (error) {
      console.error('Error getting LAB token info:', error);
      return null;
    }
  }

  // DogeFood NFT Functions
  async getNftBalance(address) {
    try {
      const balance = await this.client.readContract({
        address: CONTRACT_ADDRESSES.DOGEFOOD_NFT,
        abi: DOGEFOOD_NFT_ABI,
        functionName: 'balanceOf',
        args: [address]
      });
      
      return Number(balance);
    } catch (error) {
      console.error('Error getting NFT balance:', error);
      return 0;
    }
  }

  async getNftTotalSupply() {
    try {
      const totalSupply = await this.client.readContract({
        address: CONTRACT_ADDRESSES.DOGEFOOD_NFT,
        abi: DOGEFOOD_NFT_ABI,
        functionName: 'totalSupply'
      });
      
      return Number(totalSupply);
    } catch (error) {
      console.error('Error getting NFT total supply:', error);
      return 0;
    }
  }

  async getNftCollectionInfo() {
    try {
      const [name, symbol, totalSupply] = await Promise.all([
        this.client.readContract({
          address: CONTRACT_ADDRESSES.DOGEFOOD_NFT,
          abi: DOGEFOOD_NFT_ABI,
          functionName: 'name'
        }),
        this.client.readContract({
          address: CONTRACT_ADDRESSES.DOGEFOOD_NFT,
          abi: DOGEFOOD_NFT_ABI,
          functionName: 'symbol'
        }),
        this.client.readContract({
          address: CONTRACT_ADDRESSES.DOGEFOOD_NFT,
          abi: DOGEFOOD_NFT_ABI,
          functionName: 'totalSupply'
        })
      ]);

      return {
        name,
        symbol,
        totalSupply: Number(totalSupply),
        maxSupply: 420,
        address: CONTRACT_ADDRESSES.DOGEFOOD_NFT
      };
    } catch (error) {
      console.error('Error getting NFT collection info:', error);
      return null;
    }
  }

  // Check if user owns any NFTs
  async isNftHolder(address) {
    const balance = await this.getNftBalance(address);
    return balance > 0;
  }

  // Reward Distributor Functions
  async getCurrentSeason() {
    try {
      const currentSeason = await this.client.readContract({
        address: CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR,
        abi: REWARD_DISTRIBUTOR_ABI,
        functionName: 'currentSeason'
      });
      
      return Number(currentSeason);
    } catch (error) {
      console.error('Error getting current season:', error);
      return 0;
    }
  }

  async hasClaimedReward(seasonId, address) {
    try {
      const hasClaimed = await this.client.readContract({
        address: CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR,
        abi: REWARD_DISTRIBUTOR_ABI,
        functionName: 'hasClaimedSeason',
        args: [seasonId, address]
      });
      
      return hasClaimed;
    } catch (error) {
      console.error('Error checking reward claim status:', error);
      return false;
    }
  }

  // Utility Functions
  getExplorerUrl(address) {
    return `${dogeOSDevnet.blockExplorers.default.url}/address/${address}`;
  }

  getTxUrl(txHash) {
    return `${dogeOSDevnet.blockExplorers.default.url}/tx/${txHash}`;
  }

  // Get user's complete Web3 profile
  async getUserWeb3Profile(address) {
    try {
      const [labBalance, nftBalance, isHolder, currentSeason] = await Promise.all([
        this.getLabBalance(address),
        this.getNftBalance(address),
        this.isNftHolder(address),
        this.getCurrentSeason()
      ]);

      return {
        address,
        labBalance,
        nftBalance,
        isNftHolder: isHolder,
        currentSeason,
        explorerUrl: this.getExplorerUrl(address)
      };
    } catch (error) {
      console.error('Error getting user Web3 profile:', error);
      return null;
    }
  }
}

// Export singleton instance
export const blockchainService = new BlockchainService();