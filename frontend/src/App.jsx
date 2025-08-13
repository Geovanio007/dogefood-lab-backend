import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import MainMenu from './components/MainMenu';
import GameLab from './components/GameLab';
import NFTShowcase from './components/NFTShowcase';
import Leaderboard from './components/Leaderboard';
import Settings from './components/Settings';
import { GameProvider } from './contexts/GameContext';
import './App.css';

function App() {
  return (
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
    </GameProvider>
  );
}

export default App;