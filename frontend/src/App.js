import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { GameProvider } from './contexts/GameContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Web3Provider } from './components/Web3Provider';
import WelcomeScreen from './components/WelcomeScreen';
import LoadingScreen from './components/LoadingScreen';
import MainMenu from './components/MainMenu';
import GameLab from './components/GameLab';
import MyTreats from './components/MyTreats';
import Leaderboard from './components/Leaderboard';
// import AdminDashboard from './components/AdminDashboard';
// import PointsToBlockchain from './components/PointsToBlockchain';
import './App.css';

function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handlePlayNow = () => {
    setShowWelcome(false);
    setIsLoading(true);
    
    // Loading screen duration
    setTimeout(() => {
      setIsLoading(false);
    }, 3500);
  };

  // Settings component placeholder
  const Settings = () => (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Settings</h1>
        <p className="text-xl text-gray-600">Coming Soon! 🚧</p>
        <Link to="/" className="text-blue-600 underline mt-4 block">← Back to Main Menu</Link>
      </div>
    </div>
  );

  return (
    <ThemeProvider>
      <Web3Provider>
        <GameProvider>
          <div className="App">
            {/* Welcome Screen - First screen users see */}
            {showWelcome && (
              <WelcomeScreen onPlayNow={handlePlayNow} />
            )}

            {/* Loading Screen - After clicking Play Now */}
            {!showWelcome && isLoading && <LoadingScreen />}

            {/* Main Application - After loading */}
            {!showWelcome && !isLoading && (
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
            )}
          </div>
        </GameProvider>
      </Web3Provider>
    </ThemeProvider>
  );
}

export default App;