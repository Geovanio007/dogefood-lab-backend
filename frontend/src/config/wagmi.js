import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';

// Define DogeOS Chikyū Testnet chain
export const dogeOSDevnet = defineChain({
  id: 6281971,
  name: 'DogeOS Chikyū Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Dogecoin',
    symbol: 'DOGE',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.dogeos.com'],
      webSocket: ['wss://ws.rpc.testnet.dogeos.com'],
    },
    public: {
      http: ['https://rpc.testnet.dogeos.com'],
      webSocket: ['wss://ws.rpc.testnet.dogeos.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'DogeOS Explorer',
      url: 'https://explorer.testnet.dogeos.com',
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