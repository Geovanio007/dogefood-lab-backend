import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GameProvider } from './contexts/GameContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Web3Provider } from './components/Web3Provider';
import LoadingScreen from './components/LoadingScreen';
import MainMenu from './components/MainMenu';
import GameLab from './components/GameLab';
import MyTreats from './components/MyTreats';
import Leaderboard from './components/Leaderboard';
// import AdminDashboard from './components/AdminDashboard';
// import PointsToBlockchain from './components/PointsToBlockchain';
import './App.css';

// Settings placeholder component
const Settings = () => (
  <div className="min-h-screen p-8">
    <h1 className="text-4xl font-bold text-center">⚙️ Settings</h1>
    <p className="text-center mt-4">Coming Soon!</p>
    <a href="/" className="block text-center mt-4 text-blue-600">← Back to Menu</a>
  </div>
);

function App() {
  const [isLoading, setIsLoading] = useState(true);

  const handleLoadingComplete = () => {
    setIsLoading(false);
  };

  if (isLoading) {
    return <LoadingScreen onLoadingComplete={handleLoadingComplete} />;
  }

  return (
    <ThemeProvider>
      <Web3Provider>
        <GameProvider>
          <div className="App">
            <Router>
              <Routes>
                <Route path="/" element={<MainMenu />} />
                <Route path="/lab" element={<GameLab />} />
                <Route path="/nfts" element={<MyTreats />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/settings" element={<Settings />} />
                {/* <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/convert" element={<PointsToBlockchain />} /> */}
              </Routes>
            </Router>
          </div>
        </GameProvider>
      </Web3Provider>
    </ThemeProvider>
  );
}

export default App;