import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from './wagmi';
import MainMenu from './components/MainMenu';
import GameLab from './components/GameLab';
import NFTShowcase from './components/NFTShowcase';
import Leaderboard from './components/Leaderboard';
import Settings from './components/Settings';
import { GameProvider } from './contexts/GameContext';
import { Toaster } from 'sonner';
import './App.css';

const queryClient = new QueryClient();

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <GameProvider>
            <Toaster position="top-right" richColors />
              <div className="App">
                <Router>
                  <Routes>
                    <Route path="/" element={<MainMenu />} />
                    <Route path="/lab" element={<GameLab />} />
                    <Route path="/nfts" element={<NFTShowcase />} />
                    <Route path="/leaderboard" element={<Leaderboard />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </Router>
              </div>
            </ToastProvider>
          </GameProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;