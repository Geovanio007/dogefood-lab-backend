import '@rainbow-me/rainbowkit/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, getDefaultWallets } from '@rainbow-me/rainbowkit';
import { configureChains, createConfig } from 'wagmi';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';
import { dogeOSDevnet } from '../config/wagmi';

const queryClient = new QueryClient();

// Simple configuration without WalletConnect Project ID requirement
const { chains, publicClient } = configureChains(
  [dogeOSDevnet],
  [
    jsonRpcProvider({
      rpc: (chain) => ({
        http: 'https://rpc.devnet.doge.xyz',
      }),
    }),
  ]
);

const { connectors } = getDefaultWallets({
  appName: 'DogeFood Lab Beta',
  projectId: 'demo', // Using demo project ID
  chains,
});

const config = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
});

export function Web3Provider({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider chains={chains}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}