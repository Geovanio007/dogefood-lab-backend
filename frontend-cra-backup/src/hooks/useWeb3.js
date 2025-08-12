import { useState, useEffect } from 'react';
import { useAccount, useNetwork, useSwitchNetwork, useSignMessage } from 'wagmi';
import { dogeOSDevnet } from '../config/wagmi';

export const useWeb3 = () => {
  const { address, isConnected, isConnecting } = useAccount();
  const { chain } = useNetwork();
  const { switchNetwork } = useSwitchNetwork();
  const { signMessageAsync } = useSignMessage();
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);

  useEffect(() => {
    setIsCorrectNetwork(chain?.id === dogeOSDevnet.id);
  }, [chain]);

  const switchToDogeOS = async () => {
    try {
      if (switchNetwork) {
        switchNetwork(dogeOSDevnet.id);
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
    chainId: chain?.id,
    signAuthMessage,
    switchToDogeOS,
    dogeOSDevnet,
  };
};