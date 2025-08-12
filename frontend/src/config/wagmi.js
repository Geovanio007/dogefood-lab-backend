import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultWallets,
  RainbowKitProvider
} from '@rainbow-me/rainbowkit';
import { configureChains, createClient, WagmiConfig, mainnet, goerli } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';

// Define DogeOS Devnet chain
const dogeOSDevnet = {
  id: 221122420,
  name: 'DogeOS Devnet',
  network: 'dogeos-devnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Dogecoin',
    symbol: 'DOGE',
  },
  rpcUrls: {
    public: 'https://rpc.devnet.doge.xyz',
    default: 'https://rpc.devnet.doge.xyz',
  },
  blockExplorers: {
    default: { name: 'DogeOS Explorer', url: 'https://blockscout.devnet.doge.xyz' },
  },
  testnet: true,
};

// Configure chains
const { chains, provider } = configureChains(
  [mainnet, dogeOSDevnet], // Include mainnet to avoid connection issues
  [publicProvider()]
);

// Wallet connectors
const { connectors } = getDefaultWallets({
  appName: 'DogeFood Lab Beta',
  chains
});

// Wagmi client
const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider
});

export function Web3Provider({ children }) {
  return (
    <WagmiConfig client={wagmiClient}>
      <RainbowKitProvider chains={chains}>
        {children}
      </RainbowKitProvider>
    </WagmiConfig>
  );
}

export { dogeOSDevnet, wagmiClient, chains };