import { useState, useEffect } from 'react';
import { useAccount, useSignMessage, useChainId, useSwitchChain } from 'wagmi';
import { dogeOSDevnet } from '../config/wagmi';

export const useWeb3 = () => {
  const { address, isConnected, isConnecting } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);

  useEffect(() => {
    setIsCorrectNetwork(chainId === dogeOSDevnet.id);
  }, [chainId]);

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
    signAuthMessage,
    switchToDogeOS,
    dogeOSDevnet,
  };
};