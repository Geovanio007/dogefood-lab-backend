import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, polygon, arbitrum, base } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'DogeFood Lab',
  projectId: 'dogefood-lab-project-id',
  chains: [mainnet, polygon, arbitrum, base],
  ssr: false,
});