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

// WalletConnect project ID - required for mobile wallet connections
const projectId = process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || '';

export const wagmiConfig = getDefaultConfig({
  appName: 'DogeFood Lab Beta',
  projectId: projectId,
  chains: [dogeOSDevnet],
  ssr: false,
  // Enable WalletConnect for mobile
  walletConnectParameters: {
    projectId: projectId,
    metadata: {
      name: 'DogeFood Lab',
      description: 'Create treats, earn points, climb the leaderboard on DogeOS!',
      url: 'https://app-eight-bay-35.vercel.app',
      icons: ['https://customer-assets.emergentagent.com/job_dogefoodlab/artifacts/ckey490s_20250812_154617.jpg']
    }
  }
});