import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';

// Define DogeOS Devnet chain
export const dogeOSDevnet = defineChain({
  id: 221122420,
  name: 'DogeOS Devnet',
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
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID_HERE',
  chains: [dogeOSDevnet],
  ssr: false,
});