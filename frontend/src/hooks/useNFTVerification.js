import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES, DOGEFOOD_NFT_ABI } from '../config/contracts';

export const useNFTVerification = () => {
  const { address, isConnected } = useAccount();
  const [nftBalance, setNftBalance] = useState(0);
  const [isNFTHolder, setIsNFTHolder] = useState(false);
  const [loading, setLoading] = useState(false);

  // Read NFT balance using Wagmi
  const { data: balance, isError, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.DOGEFOOD_NFT,
    abi: DOGEFOOD_NFT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    enabled: !!address && isConnected,
  });

  useEffect(() => {
    if (balance !== undefined) {
      const balanceNumber = Number(balance);
      setNftBalance(balanceNumber);
      setIsNFTHolder(balanceNumber > 0);
      setLoading(false);
    } else if (isLoading) {
      setLoading(true);
    } else if (isError) {
      setNftBalance(0);
      setIsNFTHolder(false);
      setLoading(false);
    }
  }, [balance, isLoading, isError]);

  // Reset when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setNftBalance(0);
      setIsNFTHolder(false);
      setLoading(false);
    }
  }, [isConnected]);

  return {
    nftBalance,
    isNFTHolder,
    loading,
    address,
    isConnected
  };
};