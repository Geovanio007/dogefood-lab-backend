import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import MainMenu from './components/MainMenu.jsx';
import GameLab from './components/GameLab.jsx';
import NFTShowcase from './components/NFTShowcase.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import Settings from './components/Settings.jsx';
import { GameProvider } from './contexts/GameContext.jsx';
import { Web3Provider } from './components/Web3Provider.jsx';

function App() {
  return (
    <Web3Provider>
      <GameProvider>
        <Toaster position="top-right" richColors />
        <div className="App min-h-screen">
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
      </GameProvider>
    </Web3Provider>
  );
}

export default App;
