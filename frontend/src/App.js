import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GameProvider } from './contexts/GameContext';
import MainMenu from './components/MainMenu';
import './App.css';

// Placeholder components
const GameLab = () => (
  <div className="min-h-screen p-8">
    <h1 className="text-4xl font-bold text-center">🧪 Game Lab</h1>
    <p className="text-center mt-4">Coming Soon!</p>
    <a href="/" className="block text-center mt-4 text-blue-600">← Back to Menu</a>
  </div>
);

const NFTShowcase = () => (
  <div className="min-h-screen p-8">
    <h1 className="text-4xl font-bold text-center">🎨 My Treats</h1>
    <p className="text-center mt-4">Coming Soon!</p>
    <a href="/" className="block text-center mt-4 text-blue-600">← Back to Menu</a>
  </div>
);

const Leaderboard = () => (
  <div className="min-h-screen p-8">
    <h1 className="text-4xl font-bold text-center">🏆 Leaderboard</h1>
    <p className="text-center mt-4">Coming Soon!</p>
    <a href="/" className="block text-center mt-4 text-blue-600">← Back to Menu</a>
  </div>
);

const Settings = () => (
  <div className="min-h-screen p-8">
    <h1 className="text-4xl font-bold text-center">⚙️ Settings</h1>
    <p className="text-center mt-4">Coming Soon!</p>
    <a href="/" className="block text-center mt-4 text-blue-600">← Back to Menu</a>
  </div>
);

function App() {
  return (
    <GameProvider>
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