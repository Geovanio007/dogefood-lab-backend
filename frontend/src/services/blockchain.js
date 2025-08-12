import { ethers } from 'ethers';
import { dogeOSDevnet } from '../config/wagmi';
import { 
  CONTRACT_ADDRESSES, 
  LAB_TOKEN_ABI, 
  DOGEFOOD_NFT_ABI, 
  REWARD_DISTRIBUTOR_ABI 
} from '../config/contracts';

// Create provider for reading blockchain data
const provider = new ethers.providers.JsonRpcProvider(dogeOSDevnet.rpcUrls.default);

export class BlockchainService {
  constructor() {
    this.provider = provider;
  }

  // LAB Token Functions
  async getLabBalance(address) {
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.LAB_TOKEN, LAB_TOKEN_ABI, this.provider);
      const balance = await contract.balanceOf(address);
      
      // Convert from wei to LAB tokens (18 decimals)
      return ethers.utils.formatEther(balance);
    } catch (error) {
      console.error('Error getting LAB balance:', error);
      return '0';
    }
  }

  async getLabTokenInfo() {
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.LAB_TOKEN, LAB_TOKEN_ABI, this.provider);
      
      const [symbol, decimals, totalSupply] = await Promise.all([
        contract.symbol(),
        contract.decimals(),
        contract.totalSupply()
      ]);

      return {
        symbol,
        decimals,
        totalSupply: ethers.utils.formatUnits(totalSupply, decimals),
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
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.DOGEFOOD_NFT, DOGEFOOD_NFT_ABI, this.provider);
      const balance = await contract.balanceOf(address);
      
      return balance.toNumber();
    } catch (error) {
      console.error('Error getting NFT balance:', error);
      return 0;
    }
  }

  async getNftTotalSupply() {
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.DOGEFOOD_NFT, DOGEFOOD_NFT_ABI, this.provider);
      const totalSupply = await contract.totalSupply();
      
      return totalSupply.toNumber();
    } catch (error) {
      console.error('Error getting NFT total supply:', error);
      return 0;
    }
  }

  async getNftCollectionInfo() {
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.DOGEFOOD_NFT, DOGEFOOD_NFT_ABI, this.provider);
      
      const [name, symbol, totalSupply] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.totalSupply()
      ]);

      return {
        name,
        symbol,
        totalSupply: totalSupply.toNumber(),
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
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR, REWARD_DISTRIBUTOR_ABI, this.provider);
      const currentSeason = await contract.currentSeason();
      
      return currentSeason.toNumber();
    } catch (error) {
      console.error('Error getting current season:', error);
      return 0;
    }
  }

  async hasClaimedReward(seasonId, address) {
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR, REWARD_DISTRIBUTOR_ABI, this.provider);
      const hasClaimed = await contract.hasClaimedSeason(seasonId, address);
      
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