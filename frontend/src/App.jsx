import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

import { GameProvider } from './contexts/GameContext.jsx';
import { wagmiConfig } from './config/wagmi.js';
import MainMenu from './components/MainMenu.jsx';
import GameLab from './components/GameLab.jsx';

// Create a client for React Query
const queryClient = new QueryClient();

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <GameProvider>
            <div className="App min-h-screen">
              <Router>
                <Routes>
                  <Route path="/" element={<MainMenu />} />
                  <Route path="/lab" element={<GameLab />} />
                </Routes>
              </Router>
            </div>
          </GameProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
