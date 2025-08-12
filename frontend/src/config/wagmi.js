import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet } from 'wagmi/chains';

// Define DogeOS Devnet chain in simple format
export const dogeOSDevnet = {
  id: 221122420,
  name: 'DogeOS Devnet',
  network: 'dogeos-devnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Dogecoin',
    symbol: 'DOGE',
  },
  rpcUrls: {
    public: { http: ['https://rpc.devnet.doge.xyz'] },
    default: { http: ['https://rpc.devnet.doge.xyz'] },
  },
  blockExplorers: {
    default: { name: 'DogeOS Explorer', url: 'https://blockscout.devnet.doge.xyz' },
  },
  testnet: true,
};

export const config = getDefaultConfig({
  appName: 'DogeFood Lab Beta',
  projectId: process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID_HERE',
  chains: [mainnet, dogeOSDevnet], // Include mainnet to avoid errors
  ssr: false,
});