import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { GameProvider } from './contexts/GameContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Web3Provider } from './components/Web3Provider';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
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

// Inner App component that has access to wagmi hooks
const InnerApp = () => {
  const { address, isConnected } = useAccount();
  const [showWelcome, setShowWelcome] = useState(() => {
    // Only show welcome screen if user is on the home page
    return window.location.pathname === '/';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [userRegistered, setUserRegistered] = useState(false);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(false);

  // Check registration status when wallet connects
  useEffect(() => {
    const checkRegistrationStatus = async () => {
      if (!address || !isConnected) {
        setUserRegistered(false);
        setShowRegistration(false);
        return;
      }

      setIsCheckingRegistration(true);
      
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/player/${address}`);
        
        if (response.ok) {
          const playerData = await response.json();
          if (playerData && playerData.nickname) {
            // User is already registered
            setUserRegistered(true);
            setShowRegistration(false);
            console.log("✅ User already registered:", playerData.nickname);
          } else {
            // User exists but no nickname - needs registration
            setUserRegistered(false);
            setShowRegistration(true);
          }
        } else if (response.status === 404) {
          // User doesn't exist - needs registration
          setUserRegistered(false);
          setShowRegistration(true);
        } else {
          console.error("Error checking registration status:", response.status);
          setUserRegistered(false);
          setShowRegistration(false);
        }
      } catch (error) {
        console.error("Error checking registration status:", error);
        setUserRegistered(false);
        setShowRegistration(false);
      } finally {
        setIsCheckingRegistration(false);
      }
    };

    // Only check registration after welcome and loading screens
    if (!showWelcome && !isLoading) {
      checkRegistrationStatus();
    }
  }, [address, isConnected, showWelcome, isLoading]);

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

        {/* Registration Status Checking */}
        {!showWelcome && !isLoading && isCheckingRegistration && (
          <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
            <Card className="glass-panel max-w-md mx-auto">
              <CardContent className="text-center py-8 space-y-4">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-white/90">Checking registration status...</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Application - After loading and registration check */}
        {!showWelcome && !isLoading && !isCheckingRegistration && (
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
              <>
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
                {/* Global Treat Notifications */}
                <TreatNotifications />
              </>
            )}
            
            {/* Show registration prompt if not registered and connected */}
            {!showRegistration && !userRegistered && isConnected && !isCheckingRegistration && (
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

            {/* Show wallet connection prompt if not connected */}
            {!isConnected && !isCheckingRegistration && (
              <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
                <Card className="glass-panel max-w-md mx-auto">
                  <CardHeader className="text-center">
                    <CardTitle className="playful-title text-white text-2xl">
                      🔗 Connect Wallet
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center space-y-4">
                    <p className="text-white/90">
                      Please connect your wallet to access DogeFood Lab.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </Router>
        )}
      </div>
    </GameProvider>
  );
};

// Main App component that wraps with providers
function App() {
  return (
    <ThemeProvider>
      <Web3Provider>
        <InnerApp />
      </Web3Provider>
    </ThemeProvider>
  );
};

export default App;