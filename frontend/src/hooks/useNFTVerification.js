import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES, DOGEFOOD_NFT_ABI } from '../config/contracts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const useNFTVerification = () => {
  const { address, isConnected } = useAccount();
  const [nftBalance, setNftBalance] = useState(0);
  const [isNFTHolder, setIsNFTHolder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vipBonusCredited, setVipBonusCredited] = useState(false);

  // Read NFT balance using Wagmi
  const { data: balance, isError, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.DOGEFOOD_NFT,
    abi: DOGEFOOD_NFT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    enabled: !!address && isConnected,
  });

  // Verify NFT status with backend and credit bonus if needed
  const verifyWithBackend = useCallback(async (walletAddress, nftBal, isHolder) => {
    if (!walletAddress || !BACKEND_URL) return;
    
    try {
      console.log(`🔍 Verifying NFT status with backend for ${walletAddress}...`);
      const response = await fetch(`${BACKEND_URL}/api/player/${walletAddress}/verify-nft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_nft_holder: isHolder,
          nft_balance: nftBal
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('🎫 NFT Verification Result:', data);
        
        if (data.vip_bonus_credited) {
          setVipBonusCredited(true);
          console.log('🌟 VIP BONUS CREDITED: 500 points!');
          // You could show a toast/notification here
        }
        
        return data;
      }
    } catch (error) {
      console.error('Error verifying NFT with backend:', error);
    }
    return null;
  }, []);

  useEffect(() => {
    if (balance !== undefined) {
      const balanceNumber = Number(balance);
      setNftBalance(balanceNumber);
      const isHolder = balanceNumber > 0;
      setIsNFTHolder(isHolder);
      setLoading(false);
      
      // Verify with backend to credit VIP bonus if needed
      if (address && isConnected) {
        verifyWithBackend(address, balanceNumber, isHolder);
      }
    } else if (isLoading) {
      setLoading(true);
    } else if (isError) {
      setNftBalance(0);
      setIsNFTHolder(false);
      setLoading(false);
    }
  }, [balance, isLoading, isError, address, isConnected, verifyWithBackend]);

  // Reset when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setNftBalance(0);
      setIsNFTHolder(false);
      setLoading(false);
      setVipBonusCredited(false);
    }
  }, [isConnected]);

  return {
    nftBalance,
    isNFTHolder,
    loading,
    address,
    isConnected,
    vipBonusCredited,
    verifyWithBackend
  };
};