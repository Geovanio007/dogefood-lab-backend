import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';

// Define DogeOS Testnet chain
// Chain ID 221122 (0x35fc2) - verified from RPC response
export const dogeOSDevnet = defineChain({
  id: 221122,
  name: 'DogeOS Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Dogecoin',
    symbol: 'DOGE',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.devnet.doge.xyz'],
    },
    public: {
      http: ['https://rpc.devnet.doge.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'DogeOS Explorer',
      url: 'https://blockscout.devnet.doge.xyz',
    },
  },
  testnet: true,
});

export const wagmiConfig = getDefaultConfig({
  appName: 'DogeFood Lab Beta',
  projectId: process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || '',
  chains: [dogeOSDevnet],
  ssr: false,
});