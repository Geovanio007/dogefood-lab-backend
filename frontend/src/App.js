import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { GameProvider } from './contexts/GameContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { TelegramProvider, useTelegram } from './contexts/TelegramContext';
import { Web3Provider } from './components/Web3Provider';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import WelcomeScreen from './components/WelcomeScreen';
import LoadingScreen from './components/LoadingScreen';
import MainMenu from './components/MainMenu';
import GameLabNew from './components/GameLabNew';
import MyTreats from './components/MyTreats';
import Leaderboard from './components/Leaderboard';
import Settings from './components/Settings';
import AdminDashboard from './components/AdminDashboard';
import ActiveTreatsStatus from './components/ActiveTreatsStatus';
import TreatNotifications from './components/TreatNotifications';
import UserRegistration from './components/UserRegistration';
import TelegramAuth from './components/TelegramAuth';
// import PointsToBlockchain from './components/PointsToBlockchain';
import './App.css';

// Inner App component that has access to wagmi and telegram hooks
const InnerApp = () => {
  const { address, isConnected } = useAccount();
  const { isTelegram, telegramUser, isAuthenticated: isTelegramAuthenticated, isLoading: isTelegramLoading } = useTelegram();
  
  const [showWelcome, setShowWelcome] = useState(() => {
    // Show welcome screen for regular browsers, skip for Telegram
    return !isTelegram && window.location.pathname === '/';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showTelegramAuth, setShowTelegramAuth] = useState(false);
  const [userRegistered, setUserRegistered] = useState(false);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(false);
  const [authType, setAuthType] = useState(null); // 'wallet', 'telegram', or 'linked'

  // Check registration status for both wallet and Telegram authentication
  useEffect(() => {
    const checkRegistrationStatus = async () => {
      // Skip if still loading Telegram or showing welcome/loading screens
      if (isTelegramLoading || showWelcome || isLoading) {
        return;
      }

      setIsCheckingRegistration(true);
      
      try {
        if (isTelegram && isTelegramAuthenticated && telegramUser) {
          // Telegram authentication flow
          console.log("🤖 Checking Telegram user registration");
          
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/player/telegram/${telegramUser.id}`);
          
          if (response.ok) {
            const playerData = await response.json();
            setUserRegistered(true);
            setAuthType(playerData.auth_type || 'telegram');
            setShowTelegramAuth(false);
            console.log("✅ Telegram user already registered:", playerData.nickname);
          } else if (response.status === 404) {
            // Telegram user not registered - show Telegram auth
            setUserRegistered(false);  
            setShowTelegramAuth(true);
            setAuthType('telegram');
            console.log("📝 Telegram user needs registration");
          }
          
        } else if (!isTelegram && address && isConnected) {
          // Wallet authentication flow (existing logic)
          console.log("💳 Checking wallet user registration");
          
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/player/${address}`);
          
          if (response.ok) {
            const playerData = await response.json();
            if (playerData && playerData.nickname) {
              setUserRegistered(true);
              setAuthType(playerData.auth_type || 'wallet');
              setShowRegistration(false);
              console.log("✅ Wallet user already registered:", playerData.nickname);
            } else {
              setUserRegistered(false);
              setShowRegistration(true);
              setAuthType('wallet');
            }
          } else if (response.status === 404) {
            setUserRegistered(false);
            setShowRegistration(true);
            setAuthType('wallet');
          }
          
        } else {
          // No authentication available
          setUserRegistered(false);
          setShowRegistration(false);
          setShowTelegramAuth(false);
          setAuthType(null);
        }
        
      } catch (error) {
        console.error("Error checking registration status:", error);
        setUserRegistered(false);
        setShowRegistration(false);
        setShowTelegramAuth(false);
      } finally {
        setIsCheckingRegistration(false);
      }
    };

    checkRegistrationStatus();
  }, [address, isConnected, isTelegram, isTelegramAuthenticated, telegramUser, isTelegramLoading, showWelcome, isLoading]);

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
            {/* Telegram Authentication Screen */}
            {showTelegramAuth && !userRegistered && isTelegram && (
              <TelegramAuth 
                onAuthComplete={(authData) => {
                  setUserRegistered(true);
                  setShowTelegramAuth(false);
                  setAuthType('telegram');
                  console.log("✅ Telegram user authenticated:", authData);
                }}
              />
            )}

            {/* Wallet Registration Screen */}
            {showRegistration && !userRegistered && !isTelegram && (
              <UserRegistration 
                onRegistrationComplete={(registrationData) => {
                  setUserRegistered(true);
                  setShowRegistration(false);
                  setAuthType('wallet');
                  console.log("✅ Wallet user registered:", registrationData);
                }}
              />
            )}
            
            {/* Main Game Routes - Only after registration */}
            {!showRegistration && !showTelegramAuth && userRegistered && (
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
            
            {/* Show registration prompt for wallet users */}
            {!showRegistration && !showTelegramAuth && !userRegistered && !isTelegram && isConnected && (
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

            {/* Show wallet connection prompt for non-Telegram users */}
            {!isTelegram && !isConnected && (
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

            {/* Show Telegram authentication error */}
            {isTelegram && !isTelegramAuthenticated && !isTelegramLoading && (
              <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 p-4 flex items-center justify-center">
                <Card className="glass-panel max-w-md mx-auto">
                  <CardHeader className="text-center">
                    <CardTitle className="playful-title text-white text-2xl">
                      🤖 Telegram Error
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center space-y-4">
                    <p className="text-white/90">
                      Unable to authenticate with Telegram. Please restart the app from your Telegram bot.
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
      <TelegramProvider>
        <Web3Provider>
          <InnerApp />
        </Web3Provider>
      </TelegramProvider>
    </ThemeProvider>
  );
};

export default App;