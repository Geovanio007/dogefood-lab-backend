import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { blockchainService } from '../services/blockchain';
import { useGame } from '../contexts/GameContext';

export const useWeb3Game = () => {
  const { address, isConnected } = useAccount();
  const { dispatch } = useGame();
  const [web3Profile, setWeb3Profile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch user's Web3 profile from blockchain
  const fetchWeb3Profile = useCallback(async () => {
    if (!address || !isConnected) {
      setWeb3Profile(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔗 Fetching Web3 profile for:', address);
      const profile = await blockchainService.getUserWeb3Profile(address);
      
      if (profile) {
        setWeb3Profile(profile);
        
        // Update game context with Web3 data
        dispatch({ 
          type: 'SET_WEB3_PROFILE', 
          payload: {
            address: profile.address,
            labBalance: profile.labBalance,
            nftBalance: profile.nftBalance,
            isNftHolder: profile.isNftHolder,
            currentSeason: profile.currentSeason
          }
        });

        console.log('✅ Web3 profile loaded:', profile);
      }
    } catch (err) {
      console.error('❌ Error fetching Web3 profile:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, dispatch]);

  // Auto-fetch profile when wallet connects
  useEffect(() => {
    fetchWeb3Profile();
  }, [fetchWeb3Profile]);

  // Clear profile when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setWeb3Profile(null);
      dispatch({ type: 'CLEAR_WEB3_PROFILE' });
    }
  }, [isConnected, dispatch]);

  // Get contract information
  const getContractInfo = useCallback(async () => {
    try {
      const [labTokenInfo, nftCollectionInfo] = await Promise.all([
        blockchainService.getLabTokenInfo(),
        blockchainService.getNftCollectionInfo()
      ]);

      return {
        labToken: labTokenInfo,
        nftCollection: nftCollectionInfo
      };
    } catch (err) {
      console.error('Error getting contract info:', err);
      return null;
    }
  }, []);

  return {
    web3Profile,
    loading,
    error,
    fetchWeb3Profile,
    getContractInfo,
    // Blockchain service methods
    getLabBalance: blockchainService.getLabBalance,
    getNftBalance: blockchainService.getNftBalance,
    isNftHolder: blockchainService.isNftHolder,
    getExplorerUrl: blockchainService.getExplorerUrl,
    getTxUrl: blockchainService.getTxUrl,
  };
};