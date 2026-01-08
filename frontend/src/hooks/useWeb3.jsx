import { useState, useEffect, useCallback } from 'react';
import { useAccount, useSignMessage, useChainId, useSwitchChain } from 'wagmi';
import { dogeOSDevnet } from '../config/wagmi';

// DogeOS chain ID - also check for string versions for mobile wallet compatibility
const DOGEOS_CHAIN_IDS = [
  221122420,           // Number form
  '221122420',         // String form
  '0xd30ba1c',         // Hex lowercase
  '0xD30BA1C',         // Hex uppercase
];

export const useWeb3 = () => {
  const { address, isConnected, isConnecting } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [detectedChainId, setDetectedChainId] = useState(null);

  // Enhanced chain ID check for mobile wallet browsers
  const checkCorrectNetwork = useCallback(() => {
    // Check wagmi's reported chainId
    const wagmiMatch = chainId === dogeOSDevnet.id || DOGEOS_CHAIN_IDS.includes(chainId);
    
    // For mobile in-wallet browsers, also check window.ethereum directly
    let directMatch = false;
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const rawChainId = window.ethereum.chainId;
        setDetectedChainId(rawChainId);
        // Convert hex to number for comparison
        const numericChainId = typeof rawChainId === 'string' && rawChainId.startsWith('0x')
          ? parseInt(rawChainId, 16)
          : parseInt(rawChainId, 10);
        
        directMatch = numericChainId === dogeOSDevnet.id || DOGEOS_CHAIN_IDS.includes(rawChainId);
        
        console.log(`🔗 Network Check - Wagmi chainId: ${chainId}, window.ethereum.chainId: ${rawChainId} (${numericChainId}), Match: ${wagmiMatch || directMatch}`);
      } catch (e) {
        console.warn('Could not read chainId from window.ethereum:', e);
      }
    }
    
    return wagmiMatch || directMatch;
  }, [chainId]);

  useEffect(() => {
    setIsCorrectNetwork(checkCorrectNetwork());
    
    // Also listen for chain changes from mobile wallets
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleChainChanged = (newChainId) => {
        console.log(`⛓️ Chain changed to: ${newChainId}`);
        setDetectedChainId(newChainId);
        // Re-check after a short delay to allow wagmi to sync
        setTimeout(() => {
          setIsCorrectNetwork(checkCorrectNetwork());
        }, 500);
      };
      
      window.ethereum.on?.('chainChanged', handleChainChanged);
      return () => {
        window.ethereum.removeListener?.('chainChanged', handleChainChanged);
      };
    }
  }, [chainId, checkCorrectNetwork]);

  const switchToDogeOS = async () => {
    try {
      if (switchChain) {
        await switchChain({ chainId: dogeOSDevnet.id });
      }
    } catch (error) {
      console.error('Failed to switch to DogeOS network:', error);
    }
  };

  const signAuthMessage = async () => {
    if (!address) throw new Error('No wallet connected');
    
    const message = `Welcome to DogeFood Lab Beta!

Sign this message to authenticate with DogeOS Devnet.

Wallet: ${address}
Time: ${new Date().toISOString()}
Network: DogeOS Devnet (Chain ID: ${dogeOSDevnet.id})

This signature is only used for authentication and costs no gas.`;

    try {
      const signature = await signMessageAsync({ message });
      return { message, signature };
    } catch (error) {
      console.error('Failed to sign message:', error);
      throw error;
    }
  };

  return {
    address,
    isConnected,
    isConnecting,
    isCorrectNetwork,
    chainId,
    detectedChainId,
    signAuthMessage,
    switchToDogeOS,
    dogeOSDevnet,
    checkCorrectNetwork,
  };
};