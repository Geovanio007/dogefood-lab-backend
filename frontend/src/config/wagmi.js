import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';

// Define DogeOS Devnet chain
export const dogeOSDevnet = defineChain({
  id: 568,
  name: 'DogeOS Devnet',
  network: 'dogeos-devnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Dogecoin',
    symbol: 'DOGE',
  },
  rpcUrls: {
    public: { http: ['https://rpc-devnet.dogechain.dog'] },
    default: { http: ['https://rpc-devnet.dogechain.dog'] },
  },
  blockExplorers: {
    default: { name: 'DogeOS Explorer', url: 'https://blockscout.devnet.doge.xyz' },
  },
  testnet: true,
});

export const config = getDefaultConfig({
  appName: 'DogeFood Lab Beta',
  projectId: process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID_HERE',
  chains: [dogeOSDevnet],
  ssr: false, // Since this is Create React App, not Next.js
});