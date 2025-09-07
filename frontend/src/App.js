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
import Settings from './components/Settings';
import AdminDashboard from './components/AdminDashboard';
import ActiveTreatsStatus from './components/ActiveTreatsStatus';
import TreatNotifications from './components/TreatNotifications';
import UserRegistration from './components/UserRegistration';
// import PointsToBlockchain from './components/PointsToBlockchain';
import './App.css';

function App() {
  const [showWelcome, setShowWelcome] = useState(() => {
    // Only show welcome screen if user is on the home page
    return window.location.pathname === '/';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [userRegistered, setUserRegistered] = useState(false);

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
            {!showWelcome && isLoading && (
              <LoadingScreen onLoadingComplete={() => setIsLoading(false)} />
            )}

            {/* Main Application - After loading */}
            {!showWelcome && !isLoading && (
              <Router>
                {/* Registration Screen */}
                {showRegistration && !userRegistered && (
                  <UserRegistration 
                    onRegistrationComplete={(registrationData) => {
                      setUserRegistered(true);
                      setShowRegistration(false);
                      console.log("✅ User registered:", registrationData);
                    }}
                  />
                )}
                
                {/* Main Game Routes - Only after registration */}
                {!showRegistration && userRegistered && (
                  <Routes>
                    <Route path="/" element={<MainMenu />} />
                    <Route path="/lab" element={<GameLab />} />
                    <Route path="/nfts" element={<MyTreats />} />
                    <Route path="/dashboard" element={<ActiveTreatsStatus />} />
                    <Route path="/leaderboard" element={<Leaderboard />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                    {/* <Route path="/convert" element={<PointsToBlockchain />} /> */}
                  </Routes>
                )}
                
                {/* Show registration prompt if not registered */}
                {!showRegistration && !userRegistered && !showWelcome && !isLoading && (
                  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
                    <Card className="glass-panel max-w-md mx-auto">
                      <CardHeader className="text-center">
                        <CardTitle className="playful-title text-white text-2xl">
                          🎮 Registration Required
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-center space-y-4">
                        <p className="text-white/90">
                          To play DogeFood Lab, you need to register your wallet with a username.
                        </p>
                        <Button 
                          onClick={() => setShowRegistration(true)}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3"
                        >
                          Start Registration
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}
                
                {/* Global Treat Notifications */}
                <TreatNotifications />
              </Router>
            )}
          </div>
        </GameProvider>
      </Web3Provider>
    </ThemeProvider>
  );
}

export default App;