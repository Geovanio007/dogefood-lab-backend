import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { useGame } from '../contexts/GameContext';
import { useNFTVerification } from '../hooks/useNFTVerification';
import ThemeToggle from './ThemeToggle';
import DogeFoodLogo from './DogeFoodLogo';
import { Beaker, Trophy, Settings, Palette, Clock, User, Check, Edit2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Season 1 End Date - 90 days from Dec 1, 2025 (Season started Dec 1, 2025)
const SEASON_1_END = new Date('2026-03-01T00:00:00Z').getTime();

// Season Countdown Component
const SeasonCountdown = () => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now();
      const diff = SEASON_1_END - now;
      
      if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }
      
      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000)
      };
    };
    
    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  return (
    <div className="bg-gradient-to-r from-sky-500/20 to-emerald-500/20 rounded-lg p-3 border border-sky-400/30">
      <div className="text-xs text-sky-300 mb-1 text-center font-semibold">⏱️ SEASON ENDS IN</div>
      <div className="flex gap-2 justify-center">
        <div className="text-center">
          <div className="bg-sky-500/30 rounded px-2 py-1 min-w-[40px]">
            <span className="text-lg font-bold text-white">{timeLeft.days}</span>
          </div>
          <span className="text-[10px] text-sky-300">DAYS</span>
        </div>
        <div className="text-center">
          <div className="bg-sky-500/30 rounded px-2 py-1 min-w-[40px]">
            <span className="text-lg font-bold text-white">{String(timeLeft.hours).padStart(2, '0')}</span>
          </div>
          <span className="text-[10px] text-sky-300">HRS</span>
        </div>
        <div className="text-center">
          <div className="bg-sky-500/30 rounded px-2 py-1 min-w-[40px]">
            <span className="text-lg font-bold text-white">{String(timeLeft.minutes).padStart(2, '0')}</span>
          </div>
          <span className="text-[10px] text-sky-300">MIN</span>
        </div>
        <div className="text-center">
          <div className="bg-emerald-500/30 rounded px-2 py-1 min-w-[40px]">
            <span className="text-lg font-bold text-emerald-400">{String(timeLeft.seconds).padStart(2, '0')}</span>
          </div>
          <span className="text-[10px] text-emerald-300">SEC</span>
        </div>
      </div>
    </div>
  );
};

const MainMenu = () => {
  const { address, isConnected } = useAccount();
  const { nftBalance, isNFTHolder, loading: nftLoading } = useNFTVerification();
  const { user, currentLevel, points, dispatch, loadPlayerData } = useGame();
  
  // Username state
  const [username, setUsername] = useState('');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  
  // Profile image state
  const [profileImage, setProfileImage] = useState(null);
  
  // Guest/Firebase user state
  const [guestUser, setGuestUser] = useState(() => {
    // Initialize from localStorage immediately
    const storedPlayer = localStorage.getItem('dogefood_player');
    if (storedPlayer) {
      try {
        return JSON.parse(storedPlayer);
      } catch (e) {
        console.error('Error parsing stored player:', e);
        return null;
      }
    }
    return null;
  });
  const [playerLevel, setPlayerLevel] = useState(1);
  const [playerPoints, setPlayerPoints] = useState(0);

  // Check for guest/firebase user on mount and when localStorage changes
  useEffect(() => {
    const loadStoredPlayer = () => {
      const storedPlayer = localStorage.getItem('dogefood_player');
      if (storedPlayer) {
        try {
          const player = JSON.parse(storedPlayer);
          setGuestUser(player);
          setUsername(player.username || '');
          
          // Load full profile from backend
          const playerId = player.guest_id || player.id || player.address;
          if (playerId) {
            loadGuestProfile(playerId);
          }
        } catch (e) {
          console.error('Error parsing stored player:', e);
        }
      }
    };
    
    loadStoredPlayer();
    
    // Listen for storage changes (in case user registers in another flow)
    const handleStorageChange = (e) => {
      if (e.key === 'dogefood_player') {
        loadStoredPlayer();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom event dispatched after registration
    const handlePlayerRegistered = () => {
      loadStoredPlayer();
    };
    window.addEventListener('dogefood_player_registered', handlePlayerRegistered);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('dogefood_player_registered', handlePlayerRegistered);
    };
  }, []);

  // Load guest/firebase user profile
  const loadGuestProfile = async (playerId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/player/${playerId}/profile`);
      if (response.ok) {
        const profile = await response.json();
        setUsername(profile.nickname || '');
        setProfileImage(profile.profile_image || null);
        setPlayerLevel(profile.level || 1);
        setPlayerPoints(profile.points || 0);
      }
    } catch (error) {
      console.error('Error loading guest profile:', error);
    }
  };

  // Load player profile including username and profile image (for wallet users)
  useEffect(() => {
    const loadProfile = async () => {
      if (isConnected && address) {
        try {
          const response = await fetch(`${BACKEND_URL}/api/player/${address}/profile`);
          if (response.ok) {
            const profile = await response.json();
            setUsername(profile.nickname || '');
            setProfileImage(profile.profile_image || null);
          }
        } catch (error) {
          console.error('Error loading profile:', error);
        }
      }
    };
    loadProfile();
  }, [isConnected, address]);

  // Determine if user is logged in (wallet or guest/firebase)
  const isLoggedIn = isConnected || guestUser;
  const effectiveAddress = address || guestUser?.guest_id || guestUser?.id;
  const effectiveLevel = isConnected ? currentLevel : playerLevel;
  const effectivePoints = isConnected ? points : playerPoints;

  // Handle profile image upload
  const handleProfileImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB');
      return;
    }
    
    // Convert to base64 for preview and upload
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Image = event.target.result;
      setProfileImage(base64Image);
      
      // Save to backend
      try {
        const response = await fetch(`${BACKEND_URL}/api/player/${effectiveAddress}/profile-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Image })
        });
        
        if (!response.ok) {
          console.error('Failed to upload profile image');
        }
      } catch (error) {
        console.error('Error uploading profile image:', error);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUsername = async () => {
    if (!usernameInput.trim()) {
      setUsernameError('Username cannot be empty');
      return;
    }
    
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(usernameInput)) {
      setUsernameError('3-20 characters, alphanumeric and underscores only');
      return;
    }
    
    setSavingUsername(true);
    setUsernameError('');
    
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/player/${effectiveAddress}/update-username?username=${encodeURIComponent(usernameInput)}`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        setUsername(usernameInput);
        setIsEditingUsername(false);
      } else {
        const error = await response.json();
        setUsernameError(error.detail || 'Failed to save username');
      }
    } catch (error) {
      setUsernameError('Failed to save username');
    } finally {
      setSavingUsername(false);
    }
  };

  // Update game state when wallet connects and NFT status is determined
  useEffect(() => {
    if (isConnected && address && !nftLoading) {
      dispatch({ 
        type: 'SET_USER', 
        payload: { 
          address, 
          isNFTHolder,
          nftBalance
        } 
      });
      
      // Load player data from backend
      loadPlayerData(address);
    } else if (!isConnected) {
      dispatch({ type: 'SET_USER', payload: null });
    }
  }, [isConnected, address, isNFTHolder, nftBalance, nftLoading, dispatch]);

  return (
    <div className="lab-container min-h-screen p-4 sm:p-8">
      {/* Background Lab Scene */}
      <div className="absolute inset-0 opacity-10">
        <img
          src="https://images.unsplash.com/photo-1578272018819-412aef6cb45d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHxsYWJvcmF0b3J5JTIwZXF1aXBtZW50JTIwY29sb3JmdWx8ZW58MHx8fHwxNzU0OTQ2OTAwfDA&ixlib=rb-4.1.0&q=85"
          alt="Lab Background"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        
        {/* Header - Mobile Optimized */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-12">
          {/* Logo and Tagline */}
          <div className="w-full sm:w-auto">
            <DogeFoodLogo 
              size="hero" 
              showText={false} 
              showBeta={true}
              className="animate-fade-in mb-2 sm:mb-4 scale-75 sm:scale-100 origin-left"
            />
            <p className="text-sm sm:text-2xl text-yellow-500 font-bold drop-shadow-lg">
              Mix, Test & Upgrade Your Way to the Top! 🚀
            </p>
          </div>

          {/* Right Side Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
            {/* Theme Toggle Button */}
            <ThemeToggle />
            
            {isConnected && (
              <div className="flex items-center gap-2 flex-wrap">
                {isNFTHolder && (
                  <Badge className="vip-badge text-xs sm:text-sm whitespace-nowrap">
                    VIP 👨‍🔬
                  </Badge>
                )}
                <div className="glass-panel p-2 sm:p-3">
                  <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">Lv {currentLevel}</div>
                  <div className="font-bold text-sm sm:text-lg">{points} Pts</div>
                </div>
              </div>
            )}
            
            {/* Wallet Connection - Mobile Optimized */}
            <div className="wallet-connection-wrapper">
              <ConnectButton.Custom>
                {({
                  account,
                  chain,
                  openAccountModal,
                  openChainModal,
                  openConnectModal,
                  authenticationStatus,
                  mounted,
                }) => {
                  const ready = mounted && authenticationStatus !== 'loading';
                  const connected =
                    ready &&
                    account &&
                    chain &&
                    (!authenticationStatus ||
                      authenticationStatus === 'authenticated');

                  return (
                    <div
                      {...(!ready && {
                        'aria-hidden': true,
                        'style': {
                          opacity: 0,
                          pointerEvents: 'none',
                          userSelect: 'none',
                        },
                      })}
                    >
                      {(() => {
                        if (!connected) {
                          return (
                            <Button
                              onClick={openConnectModal}
                              className="doge-button text-xs sm:text-sm px-3 sm:px-4 py-2"
                            >
                              Connect Wallet
                            </Button>
                          );
                        }

                        if (chain.unsupported) {
                          return (
                            <Button
                              onClick={openChainModal}
                              className="bg-red-500 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm"
                            >
                              Wrong network
                            </Button>
                          );
                        }

                        return (
                          <Button
                            onClick={openAccountModal}
                            className="doge-button text-xs sm:text-sm px-3 sm:px-4 py-2 font-mono"
                          >
                            {`${account.address.slice(0,4)}...${account.address.slice(-3)}`}
                          </Button>
                        );
                      })()}
                    </div>
                  );
                }}
              </ConnectButton.Custom>
            </div>
          </div>
        </div>
        
        {/* Username Section - Modern Design - Show for wallet users, guest users, or firebase users */}
        {isLoggedIn && (
          <div className="mb-4 sm:mb-6">
            <Card className="overflow-hidden border-0 shadow-xl">
              {/* Gradient Border - Same as Season 1 Banner */}
              <div className="relative bg-gradient-to-r from-sky-400 via-emerald-400 to-yellow-400 p-0.5 sm:p-1">
                <CardContent className="relative bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 rounded-lg p-3 sm:p-4 backdrop-blur-sm">
                  {/* Decorative Elements - Hidden on mobile */}
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-yellow-400/20 to-transparent rounded-full blur-2xl hidden sm:block"></div>
                  
                  {/* Guest/Firebase user badge */}
                  {guestUser && !isConnected && (
                    <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                      <Badge className="bg-sky-500/20 text-sky-300 text-[10px] sm:text-xs border border-sky-500/30">
                        {guestUser.auth_type === 'firebase' ? '🔥 ' : '👤 '}
                        {guestUser.auth_type === 'firebase' ? 'Firebase' : 'Guest'}
                      </Badge>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-3 sm:gap-4 relative z-10">
                    {/* Profile Section */}
                    <div className="flex items-center gap-3 sm:gap-4">
                      {/* Profile Picture - Clickable for upload */}
                      <div className="relative flex-shrink-0 group">
                        <label htmlFor="profile-upload" className="cursor-pointer">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-sky-400 via-emerald-400 to-yellow-400 rounded-xl flex items-center justify-center shadow-lg overflow-hidden">
                            {profileImage ? (
                              <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                            )}
                          </div>
                          <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-xs">📷</span>
                          </div>
                        </label>
                        <input
                          id="profile-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleProfileImageUpload}
                        />
                        {isNFTHolder && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-yellow-400 rounded-full flex items-center justify-center text-[10px] sm:text-xs">⭐</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] sm:text-xs text-emerald-400 font-semibold uppercase tracking-wide">Scientist Profile</div>
                        {!isEditingUsername ? (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm sm:text-lg bg-gradient-to-r from-sky-400 via-emerald-400 to-yellow-400 bg-clip-text text-transparent truncate">
                              {username || 'Set username'}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setUsernameInput(username);
                                setIsEditingUsername(true);
                                setUsernameError('');
                              }}
                              className="p-1 h-auto hover:bg-white/10 flex-shrink-0"
                            >
                              <Edit2 className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <Input
                                value={usernameInput}
                                onChange={(e) => setUsernameInput(e.target.value)}
                                placeholder="Username"
                                className="w-24 sm:w-36 h-7 sm:h-8 text-xs sm:text-sm bg-white/10 border-white/20 text-white placeholder:text-white/50"
                                maxLength={20}
                              />
                              <Button
                                size="sm"
                                onClick={handleSaveUsername}
                                disabled={savingUsername}
                                className="bg-emerald-500 hover:bg-emerald-600 h-7 sm:h-8 px-2 sm:px-3"
                              >
                                {savingUsername ? '...' : <Check className="w-3 h-3 sm:w-4 sm:h-4" />}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setIsEditingUsername(false)}
                                className="h-7 sm:h-8 px-1 sm:px-2 text-white/70 hover:text-white hover:bg-white/10"
                              >
                                ✕
                              </Button>
                            </div>
                            {usernameError && (
                              <span className="text-[10px] sm:text-xs text-red-400">{usernameError}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Stats Row - Mobile Optimized */}
                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                      <div className="flex items-center gap-2 sm:gap-3 bg-white/5 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2">
                        <div className="text-center">
                          <div className="text-[10px] sm:text-xs text-white/60">Level</div>
                          <div className="font-bold text-sm sm:text-lg text-white">{effectiveLevel || 1}</div>
                        </div>
                        <div className="w-px h-6 sm:h-8 bg-white/20"></div>
                        <div className="text-center">
                          <div className="text-[10px] sm:text-xs text-white/60">Points</div>
                          <div className="font-bold text-sm sm:text-lg text-emerald-400">{effectivePoints || 0}</div>
                        </div>
                      </div>
                      
                      {isNFTHolder ? (
                        <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-bold shadow-lg border-0 whitespace-nowrap">
                          🌟 VIP
                        </Badge>
                      ) : guestUser && !isConnected && (
                        <Badge className="bg-gradient-to-r from-sky-500 to-emerald-500 text-white px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-bold shadow-lg border-0 whitespace-nowrap">
                          🎮 Player
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          </div>
        )}

        {/* Season 1 Announcement Banner - Mobile Optimized */}
        <div className="mb-4 sm:mb-8">
          <Card className="overflow-hidden border-0 shadow-2xl">
            {/* Gradient Background */}
            <div className="relative bg-gradient-to-r from-sky-400 via-emerald-400 to-yellow-400 p-0.5 sm:p-1">
              <CardContent className="relative bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 dark:from-slate-900/98 dark:via-slate-800/98 dark:to-slate-900/98 rounded-lg p-3 sm:p-6 backdrop-blur-sm">
                {/* Decorative Elements - Hidden on mobile */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400/20 to-transparent rounded-full blur-2xl hidden sm:block"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-sky-400/20 to-transparent rounded-full blur-2xl hidden sm:block"></div>
                
                <div className="flex flex-col gap-4 sm:gap-6 relative z-10">
                  {/* Top Row - Season Info */}
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-gradient-to-br from-yellow-400 via-emerald-400 to-sky-400 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                        <span className="text-2xl sm:text-3xl md:text-4xl">🧪</span>
                      </div>
                      <div className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px] sm:text-xs font-bold shadow-md">
                        1
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-yellow-400 via-emerald-400 to-sky-400 bg-clip-text text-transparent mb-0.5 sm:mb-1">
                        Season 1: Beta
                      </h3>
                      <p className="text-white/90 dark:text-white/90 text-xs sm:text-sm md:text-base">
                        Create treats, earn points, climb the leaderboard!
                        <span className="block mt-0.5 sm:mt-1 text-emerald-400 font-semibold text-[10px] sm:text-sm">
                          NFT minting coming in Season 2!
                        </span>
                      </p>
                    </div>
                  </div>
                  
                  {/* Bottom Row - Timer & Status */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-gradient-to-r from-sky-500 to-sky-600 text-white px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-bold shadow-lg border-0">
                        🎮 SEASON 1 ACTIVE
                      </Badge>
                      <div className="flex gap-1 sm:gap-2 text-[10px] sm:text-xs">
                        <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                          Treats
                        </div>
                        <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                          Boards
                        </div>
                      </div>
                    </div>
                    {/* Real-time Season Countdown */}
                    <SeasonCountdown />
                  </div>
                </div>
              </CardContent>
            </div>
          </Card>
        </div>

        {/* Main Menu Cards - Mobile Optimized */}
        <div className="grid grid-cols-2 gap-3 sm:gap-8 mb-6 sm:mb-12">
          {/* Enter Lab */}
          <Card className="game-card hover:scale-105 transition-all duration-300 cursor-pointer">
            <Link to="/lab">
              <CardHeader className="text-center p-3 sm:p-6">
                <div className="mx-auto w-14 h-14 sm:w-24 sm:h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-2 sm:mb-4 shadow-xl">
                  <Beaker className="w-7 h-7 sm:w-12 sm:h-12 text-white drop-shadow-lg" />
                </div>
                <CardTitle className="text-base sm:text-3xl font-bold text-white">🧪 Lab</CardTitle>
              </CardHeader>
              <CardContent className="text-center p-3 sm:p-6 pt-0">
                <p className="text-white/90 mb-3 sm:mb-6 text-xs sm:text-lg hidden sm:block">
                  Start mixing magical Dogetreats and unlock new recipes!
                </p>
                <Button className="doge-button w-full text-sm sm:text-lg py-2 sm:py-2 font-bold">
                  Mix 🧪
                </Button>
              </CardContent>
            </Link>
          </Card>

          {/* My NFTs */}
          <Card className="game-card hover:scale-105 transition-all duration-300 cursor-pointer">
            <Link to="/nfts">
              <CardHeader className="text-center p-3 sm:p-6">
                <div className="mx-auto w-14 h-14 sm:w-24 sm:h-24 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center mb-2 sm:mb-4 shadow-xl">
                  <Palette className="w-7 h-7 sm:w-12 sm:h-12 text-white drop-shadow-lg" />
                </div>
                <CardTitle className="text-base sm:text-3xl font-bold text-white">🎨 Treats</CardTitle>
              </CardHeader>
              <CardContent className="text-center p-3 sm:p-6 pt-0">
                <p className="text-white/90 mb-3 sm:mb-6 text-xs sm:text-lg hidden sm:block">
                  View your created Dogetreats and rare collections!
                </p>
                <Button className="doge-button w-full text-sm sm:text-lg py-2 sm:py-2 font-bold">
                  View 🎨
                </Button>
              </CardContent>
            </Link>
          </Card>

          {/* Leaderboard */}
          <Card className="game-card hover:scale-105 transition-all duration-300 cursor-pointer">
            <Link to="/leaderboard">
              <CardHeader className="text-center p-3 sm:p-6">
                <div className="mx-auto w-14 h-14 sm:w-24 sm:h-24 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center mb-2 sm:mb-4 shadow-xl">
                  <Trophy className="w-7 h-7 sm:w-12 sm:h-12 text-white drop-shadow-lg" />
                </div>
                <CardTitle className="text-base sm:text-3xl font-bold text-white">🏆 Ranks</CardTitle>
              </CardHeader>
              <CardContent className="text-center p-3 sm:p-6 pt-0">
                <p className="text-white/90 mb-3 sm:mb-6 text-xs sm:text-lg hidden sm:block">
                  Compete with other VIP Scientists for $LAB rewards!
                </p>
                <Button className="doge-button w-full text-sm sm:text-lg py-2 sm:py-2 font-bold">
                  Compete 🏆
                </Button>
              </CardContent>
            </Link>
          </Card>

          {/* Settings */}
          <Card className="game-card hover:scale-105 transition-all duration-300 cursor-pointer">
            <Link to="/settings">
              <CardHeader className="text-center p-3 sm:p-6">
                <div className="mx-auto w-14 h-14 sm:w-24 sm:h-24 bg-gradient-to-br from-slate-400 to-slate-600 rounded-full flex items-center justify-center mb-2 sm:mb-4 shadow-xl">
                  <Settings className="w-7 h-7 sm:w-12 sm:h-12 text-white drop-shadow-lg" />
                </div>
                <CardTitle className="text-base sm:text-3xl font-bold text-white">⚙️ Settings</CardTitle>
              </CardHeader>
              <CardContent className="text-center p-3 sm:p-6 pt-0">
                <p className="text-white/90 mb-3 sm:mb-6 text-xs sm:text-lg hidden sm:block">
                  Customize your experience and manage your account
                </p>
                <Button className="doge-button w-full text-sm sm:text-lg py-2 sm:py-2 font-bold">
                  Manage ⚙️
                </Button>
              </CardContent>
            </Link>
          </Card>
        </div>

        {/* Doge Scientist Avatar */}
        <div className="text-center mb-8">
          <div className="inline-block">
            <img
              src="https://i.ibb.co/hJQcdpfM/1000025492-removebg-preview.png"
              alt="Doge Scientist"
              className="w-40 h-40 rounded-full border-6 border-yellow-400 shadow-2xl hover:scale-110 transition-transform duration-300 bg-white/20 backdrop-blur-sm"
            />
          </div>
          <h3 className="text-2xl font-bold text-yellow-500 mt-4 playful-text bubble-text">
            Welcome to DogeFood Lab!
          </h3>
        </div>

        {/* Powered By Banner Section */}
        <div className="text-center mb-12">
          <h4 className="text-lg font-semibold mb-6" style={{color: '#FFD700'}}>
            Powered by
          </h4>
          <div className="max-w-3xl mx-auto px-4">
            <img
              src="https://customer-assets.emergentagent.com/job_dogefoodlab/artifacts/ckey490s_20250812_154617.jpg"
              alt="Powered by DOGEOS"
              className="w-full h-auto rounded-xl shadow-lg border-2 border-yellow-400 hover:scale-105 transition-transform duration-300 bg-white/10 backdrop-blur-sm"
              style={{
                maxWidth: '600px',
                margin: '0 auto',
                aspectRatio: 'auto'
              }}
            />
          </div>
        </div>

        {/* Benefits Section */}
        {!isConnected && (
          <Card className="game-card">
            <CardHeader>
              <CardTitle className="text-center playful-title bubble-text text-white text-3xl">
                Connect Your Wallet to Get Started! 🔗
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="text-center p-6 bg-gradient-to-br from-green-400/30 to-emerald-500/20 rounded-3xl border-2 border-green-300/50">
                  <h4 className="font-bold text-2xl mb-3 playful-title text-white bubble-text">For Everyone 🎮</h4>
                  <ul className="text-white/90 space-y-2 playful-text text-lg">
                    <li>• Play for fun & advance levels</li>
                    <li>• Mix unlimited Dogetreats</li>
                    <li>• Unlock new ingredients</li>
                    <li>• Enjoy the full experience!</li>
                  </ul>
                </div>
                <div className="text-center p-6 bg-gradient-to-br from-yellow-400/30 to-orange-500/20 rounded-3xl border-2 border-yellow-300/50">
                  <h4 className="font-bold text-2xl mb-3 playful-title text-white bubble-text">For NFT Holders ⭐</h4>
                  <ul className="text-white/90 space-y-2 playful-text text-lg">
                    <li>• Head start with bonus resources</li>
                    <li>• Earn points for leaderboard</li>
                    <li>• Eligible for $LAB airdrops</li>
                    <li>• VIP Scientist status!</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* How it Works Link */}
        <div className="text-center mt-12 mb-8">
          <Card className="glass-panel max-w-md mx-auto bg-gradient-to-br from-indigo-600/90 to-purple-600/90 border-indigo-400/50 shadow-2xl">
            <CardContent className="p-6">
              <h3 className="text-2xl font-bold text-white mb-4">
                🧠 Need Help Understanding the Game?
              </h3>
              <p className="text-white/90 mb-6 text-lg">
                Learn all the game mechanics, strategies, and tips!
              </p>
              <Button
                onClick={() => window.open('/game-mechanisms.html', '_blank')}
                className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-bold py-4 px-8 text-xl rounded-xl shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl"
              >
                📖 How it Works
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-16">
          <p className="text-yellow-500 text-sm playful-text bubble-text">
            Built with ❤️ for the Dogecoin community • Much wow, such science! 🌙
          </p>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;