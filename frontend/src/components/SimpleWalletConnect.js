import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

const SimpleWalletConnect = ({ onWalletConnect, onWalletDisconnect, address, isConnected, isNFTHolder, nftBalance }) => {
  const [connecting, setConnecting] = useState(false);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask or another Web3 wallet to connect!');
      return;
    }

    setConnecting(true);
    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length > 0) {
        const userAddress = accounts[0];
        
        // Check if on DogeOS Devnet
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xd30ba1c' }], // 221122420 in hex
          });
        } catch (switchError) {
          // Add DogeOS Devnet if not added
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0xd30ba1c',
                  chainName: 'DogeOS Devnet',
                  nativeCurrency: {
                    name: 'DOGE',
                    symbol: 'DOGE',
                    decimals: 18,
                  },
                  rpcUrls: ['https://rpc.devnet.doge.xyz'],
                  blockExplorerUrls: ['https://blockscout.devnet.doge.xyz'],
                }],
              });
            } catch (addError) {
              console.error('Failed to add DogeOS Devnet:', addError);
              alert('Failed to add DogeOS Devnet. Please add it manually.');
              setConnecting(false);
              return;
            }
          } else {
            console.error('Failed to switch to DogeOS Devnet:', switchError);
          }
        }

        // Verify NFT ownership
        const nftBalanceResult = await checkNFTBalance(userAddress);
        
        onWalletConnect(userAddress, nftBalanceResult);
      }
    } catch (error) {
      console.error('Wallet connection failed:', error);
      alert('Wallet connection failed. Please try again.');
    }
    setConnecting(false);
  };

  const checkNFTBalance = async (userAddress) => {
    try {
      // Simple contract call to check NFT balance
      const contractAddress = '0xC8AB737B8baef6f8a33b2720fD20F27F4A54E2C0';
      
      // Create a simple contract call
      const data = '0x70a08231' + userAddress.slice(2).padStart(64, '0'); // balanceOf function signature
      
      const result = await window.ethereum.request({
        method: 'eth_call',
        params: [{
          to: contractAddress,
          data: data,
        }, 'latest'],
      });

      const balance = parseInt(result, 16);
      return { balance, isHolder: balance > 0 };
    } catch (error) {
      console.error('NFT balance check failed:', error);
      return { balance: 0, isHolder: false };
    }
  };

  const disconnectWallet = () => {
    onWalletDisconnect();
  };

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          onWalletDisconnect();
        } else if (accounts[0] !== address) {
          // Account changed, reconnect
          connectWallet();
        }
      };

      const handleChainChanged = (chainId) => {
        // Reload the page when chain changes for simplicity
        window.location.reload();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [address, onWalletDisconnect]);

  if (!isConnected) {
    return (
      <Button
        onClick={connectWallet}
        disabled={connecting}
        className="doge-button"
      >
        {connecting ? 'Connecting...' : 'Connect Wallet'}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isNFTHolder && (
        <Badge className="vip-badge">
          VIP Scientist 👨‍🔬 ({nftBalance})
        </Badge>
      )}
      <Button
        onClick={disconnectWallet}
        className="doge-button"
      >
        {`${address.slice(0,6)}...${address.slice(-4)}`}
      </Button>
    </div>
  );
};

export default SimpleWalletConnect;