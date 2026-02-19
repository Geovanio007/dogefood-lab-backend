import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { useGame } from '../contexts/GameContext';
import { useNFTVerification } from '../hooks/useNFTVerification';
import { useTelegram } from '../contexts/TelegramContext';
import ThemeToggle from './ThemeToggle';
import DogeFoodLogo from './DogeFoodLogo';
import TreatIcon from './TreatIcon';
import MusicPlayer from './MusicPlayer';
import ScientistChat from './ScientistChat';
import { Beaker, Trophy, Settings, Palette, Clock, User, Check, Edit2, X, Wallet, UserPlus, Crown, Store, Camera } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Season 1 End Date - 90 days from Dec 1, 2025 (Season started Dec 1, 2025)
const SEASON_1_END = new Date('2026-03-31T00:00:00Z').getTime();

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
    <div className="bg-slate-800/60 rounded-lg p-3 border border-white/[0.04]">
      <div className="text-[10px] sm:text-xs text-white/40 mb-2 text-center font-semibold uppercase tracking-wider">Season ends in</div>
      <div className="flex gap-2 justify-center">
        <div className="text-center">
          <div className="bg-slate-700/60 rounded-md px-2.5 py-1.5 min-w-[40px] border border-yellow-400/10">
            <span className="text-base sm:text-lg font-bold text-yellow-400 tabular-nums">{timeLeft.days}</span>
          </div>
          <span className="text-[9px] text-white/40 uppercase mt-0.5 block">Days</span>
        </div>
        <div className="text-center">
          <div className="bg-slate-700/60 rounded-md px-2.5 py-1.5 min-w-[40px] border border-sky-400/10">
            <span className="text-base sm:text-lg font-bold text-sky-400 tabular-nums">{String(timeLeft.hours).padStart(2, '0')}</span>
          </div>
          <span className="text-[9px] text-white/40 uppercase mt-0.5 block">Hrs</span>
        </div>
        <div className="text-center">
          <div className="bg-slate-700/60 rounded-md px-2.5 py-1.5 min-w-[40px] border border-sky-400/10">
            <span className="text-base sm:text-lg font-bold text-sky-400 tabular-nums">{String(timeLeft.minutes).padStart(2, '0')}</span>
          </div>
          <span className="text-[9px] text-white/40 uppercase mt-0.5 block">Min</span>
        </div>
        <div className="text-center">
          <div className="bg-slate-700/60 rounded-md px-2.5 py-1.5 min-w-[40px] border border-white/[0.06]">
            <span className="text-base sm:text-lg font-bold text-white/60 tabular-nums">{String(timeLeft.seconds).padStart(2, '0')}</span>
          </div>
          <span className="text-[9px] text-white/40 uppercase mt-0.5 block">Sec</span>
        </div>
      </div>
    </div>
  );
};

const MainMenu = () => {
  const { address, isConnected } = useAccount();
  const { nftBalance, isNFTHolder, loading: nftLoading } = useNFTVerification();
  const { user, currentLevel, points, dispatch, loadPlayerData } = useGame();
  const { telegramUser, isTelegram } = useTelegram();
  const navigate = useNavigate();
  
  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showGuestSignup, setShowGuestSignup] = useState(false);
  const [guestUsername, setGuestUsername] = useState('');
  const [guestSignupError, setGuestSignupError] = useState('');
  const [guestSignupLoading, setGuestSignupLoading] = useState(false);
  
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

  // Check if user is authenticated
  const isAuthenticated = isConnected || isTelegram || guestUser;
  
  // Handle lab access - check authentication first
  const handleLabAccess = (e) => {
    if (!isAuthenticated) {
      e.preventDefault();
      setShowAuthModal(true);
    }
  };
  
  // Handle guest signup
  const handleGuestSignup = async () => {
    if (!guestUsername || guestUsername.length < 3) {
      setGuestSignupError('Username must be at least 3 characters');
      return;
    }
    
    if (guestUsername.length > 20) {
      setGuestSignupError('Username must be 20 characters or less');
      return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(guestUsername)) {
      setGuestSignupError('Username can only contain letters, numbers, and underscores');
      return;
    }
    
    setGuestSignupLoading(true);
    setGuestSignupError('');
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/players/guest-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: guestUsername })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setGuestSignupError(data.detail || 'Registration failed');
        setGuestSignupLoading(false);
        return;
      }
      
      // Save to localStorage
      localStorage.setItem('dogefood_player', JSON.stringify({
        id: data.player_id,
        guest_id: data.guest_id,
        username: data.username,
        auth_type: 'guest'
      }));
      
      // Update state
      setGuestUser({
        id: data.player_id,
        guest_id: data.guest_id,
        username: data.username,
        auth_type: 'guest'
      });
      
      // Dispatch event
      window.dispatchEvent(new Event('dogefood_player_registered'));
      
      // Close modals and navigate to lab
      setShowAuthModal(false);
      setShowGuestSignup(false);
      setGuestSignupLoading(false);
      navigate('/lab');
      
    } catch (error) {
      console.error('Guest signup error:', error);
      setGuestSignupError('Network error. Please try again.');
      setGuestSignupLoading(false);
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
              Mix, Test & Upgrade Your Way to the Top!
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
                    VIP
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
        
        {/* Scientist Profile Card - Professional Game Card */}
        {isLoggedIn && (
          <div className="mb-4 sm:mb-6">
            <Card className="overflow-hidden border-0 shadow-xl">
              <div className="relative">
                {/* Top accent bar */}
                <div className="h-1 bg-gradient-to-r from-yellow-400 via-sky-400 to-yellow-400" />
                
                <CardContent className="relative bg-slate-900/95 p-4 sm:p-5">
                  {/* Subtle grid pattern overlay */}
                  <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                  
                  {/* Guest/Firebase badge */}
                  {guestUser && !isConnected && (
                    <div className="absolute top-3 right-3">
                      <span className="text-[10px] sm:text-xs font-medium text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-md px-2 py-0.5">
                        {guestUser.auth_type === 'firebase' ? 'Firebase' : 'Guest'}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-4 relative z-10">
                    {/* Profile header */}
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0 group">
                        <label htmlFor="profile-upload" className="cursor-pointer block">
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 border-sky-400/30 shadow-lg shadow-sky-500/10">
                            {profileImage ? (
                              <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-700 flex items-center justify-center">
                                <User className="w-7 h-7 text-sky-300/70" />
                              </div>
                            )}
                          </div>
                          <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Camera className="w-4 h-4 text-white" />
                          </div>
                        </label>
                        <input id="profile-upload" type="file" accept="image/*" className="hidden" onChange={handleProfileImageUpload} />
                        {isNFTHolder && (
                          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center shadow-md">
                            <Crown className="w-3 h-3 text-yellow-900" />
                          </div>
                        )}
                      </div>
                      
                      {/* Name + edit */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] sm:text-xs font-semibold text-sky-400/80 uppercase tracking-widest mb-0.5">Scientist</div>
                        {!isEditingUsername ? (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base sm:text-lg text-white truncate">
                              {username || 'Set username'}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setUsernameInput(username); setIsEditingUsername(true); setUsernameError(''); }}
                              className="p-1 h-auto hover:bg-white/10 flex-shrink-0"
                            >
                              <Edit2 className="w-3 h-3 sm:w-4 sm:h-4 text-sky-400/60 hover:text-sky-300" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <Input
                                value={usernameInput}
                                onChange={(e) => setUsernameInput(e.target.value)}
                                placeholder="Username"
                                className="w-24 sm:w-36 h-7 sm:h-8 text-xs sm:text-sm bg-slate-800 border-sky-400/30 text-white placeholder:text-white/40 focus:border-sky-400"
                                maxLength={20}
                              />
                              <Button size="sm" onClick={handleSaveUsername} disabled={savingUsername} className="bg-sky-500 hover:bg-sky-400 h-7 sm:h-8 px-2 sm:px-3">
                                {savingUsername ? '...' : <Check className="w-3 h-3 sm:w-4 sm:h-4" />}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setIsEditingUsername(false)} className="h-7 sm:h-8 px-1 sm:px-2 text-white/50 hover:text-white hover:bg-white/10">
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                            {usernameError && <span className="text-[10px] sm:text-xs text-red-400">{usernameError}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Stats bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 flex items-center gap-3 bg-slate-800/60 rounded-lg px-3 py-2 border border-white/[0.04]">
                        <div className="text-center flex-1">
                          <div className="text-[9px] sm:text-[10px] font-medium text-white/40 uppercase tracking-wider">Level</div>
                          <div className="font-bold text-sm sm:text-lg text-yellow-400 tabular-nums">{effectiveLevel || 1}</div>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="text-center flex-1">
                          <div className="text-[9px] sm:text-[10px] font-medium text-white/40 uppercase tracking-wider">Points</div>
                          <div className="font-bold text-sm sm:text-lg text-sky-400 tabular-nums">{effectivePoints || 0}</div>
                        </div>
                      </div>
                      
                      {isNFTHolder ? (
                        <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-3 py-2 text-center">
                          <Crown className="w-4 h-4 text-yellow-400 mx-auto mb-0.5" />
                          <div className="text-[9px] font-bold text-yellow-400 uppercase">VIP</div>
                        </div>
                      ) : guestUser && !isConnected && (
                        <div className="bg-sky-400/10 border border-sky-400/30 rounded-lg px-3 py-2 text-center">
                          <User className="w-4 h-4 text-sky-400 mx-auto mb-0.5" />
                          <div className="text-[9px] font-bold text-sky-400 uppercase">Player</div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          </div>
        )}

        {/* Season 1 Card - Professional Game Card */}
        <div className="mb-4 sm:mb-8">
          <Card className="overflow-hidden border-0 shadow-xl">
            <div className="relative">
              {/* Top accent bar */}
              <div className="h-1 bg-gradient-to-r from-sky-400 via-yellow-400 to-sky-400" />
              
              <CardContent className="relative bg-slate-900/95 p-4 sm:p-6">
                {/* Subtle grid pattern */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                
                <div className="flex flex-col gap-4 sm:gap-5 relative z-10">
                  {/* Season header */}
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-800 border-2 border-yellow-400/30 flex items-center justify-center shadow-lg shadow-yellow-500/10">
                        <Beaker className="w-7 h-7 sm:w-8 sm:h-8 text-yellow-400" />
                      </div>
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-sky-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-md border border-sky-400">
                        1
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-2xl font-bold text-white mb-0.5">
                        Season 1: Beta
                      </h3>
                      <p className="text-white/50 text-xs sm:text-sm">
                        Create treats, earn points, climb the leaderboard
                      </p>
                      <p className="text-sky-400 font-medium text-[10px] sm:text-xs mt-1">
                        NFT minting coming in Season 2
                      </p>
                    </div>
                  </div>
                  
                  {/* Status indicators */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="bg-sky-500/10 border border-sky-400/20 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold text-sky-400 uppercase tracking-wide">
                      Season 1 Active
                    </div>
                    <div className="flex gap-1.5 text-[10px] sm:text-xs">
                      <div className="flex items-center gap-1.5 bg-slate-800/60 border border-white/[0.04] text-white/60 px-2 py-1 rounded-md">
                        <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
                        Treats
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-800/60 border border-white/[0.04] text-white/60 px-2 py-1 rounded-md">
                        <span className="w-1.5 h-1.5 bg-sky-400 rounded-full" />
                        Boards
                      </div>
                    </div>
                  </div>
                  
                  {/* Season countdown */}
                  <SeasonCountdown />
                </div>
              </CardContent>
            </div>
          </Card>
        </div>

        {/* Auto-Mixer Agent Live Banner */}
        <Link to="/settings" state={{ tab: 'auto-mixer' }} className="block mb-4 sm:mb-6">
          <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 p-3 sm:p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] cursor-pointer border border-sky-400/30">
            {/* Animated background effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer" />
            
            {/* Pulsing dot indicator */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-300 text-xs font-bold hidden sm:inline">LIVE</span>
            </div>
            
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Robot Icon */}
              <div className="flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl flex items-center justify-center border border-white/20">
                <span className="text-2xl sm:text-3xl">🤖</span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 sm:mb-1">
                  <h3 className="text-base sm:text-xl font-bold text-white">Auto-Mixer Agent</h3>
                  <Badge className="bg-emerald-500/80 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">ACTIVE</Badge>
                </div>
                <p className="text-sky-100 text-xs sm:text-sm line-clamp-1">
                  Let AI mix treats for you automatically • 30 DOGE/month
                </p>
              </div>
              
              {/* Arrow icon */}
              <div className="flex-shrink-0 hidden sm:flex w-10 h-10 bg-white/10 rounded-full items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </Link>

        {/* Main Menu Cards - Compact Square Design for Telegram */}
        <div className="grid grid-cols-2 gap-2 sm:gap-6 mb-4 sm:mb-12">
          {/* Enter Lab */}
          <Link to="/lab" className="block" onClick={handleLabAccess}>
            <Card className="game-card hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer h-full">
              <CardContent className="p-2.5 sm:p-6 flex flex-col items-center justify-center text-center aspect-square sm:aspect-auto">
                <div className="w-10 h-10 sm:w-20 sm:h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl sm:rounded-2xl flex items-center justify-center mb-1.5 sm:mb-3 shadow-lg">
                  <Beaker className="w-5 h-5 sm:w-10 sm:h-10 text-white" />
                </div>
                <h3 className="text-sm sm:text-2xl font-bold text-white mb-1 sm:mb-2">Lab</h3>
                <p className="text-white/70 text-[10px] sm:text-sm mb-2 sm:mb-4 hidden sm:block line-clamp-2">
                  Mix magical Dogetreats!
                </p>
                <Button className="doge-button w-full text-xs sm:text-base py-1.5 sm:py-2.5 font-bold h-auto">
                  Mix
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* My Treats */}
          <Link to="/nfts" className="block">
            <Card className="game-card hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer h-full">
              <CardContent className="p-2.5 sm:p-6 flex flex-col items-center justify-center text-center aspect-square sm:aspect-auto">
                <div className="w-10 h-10 sm:w-20 sm:h-20 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl sm:rounded-2xl flex items-center justify-center mb-1.5 sm:mb-3 shadow-lg">
                  <Palette className="w-5 h-5 sm:w-10 sm:h-10 text-white" />
                </div>
                <h3 className="text-sm sm:text-2xl font-bold text-white mb-1 sm:mb-2 flex items-center gap-1">
                  <TreatIcon size="sm" className="sm:hidden" />
                  Treats
                </h3>
                <p className="text-white/70 text-[10px] sm:text-sm mb-2 sm:mb-4 hidden sm:block line-clamp-2">
                  View your collections!
                </p>
                <Button className="doge-button w-full text-xs sm:text-base py-1.5 sm:py-2.5 font-bold h-auto flex items-center justify-center gap-1">
                  <TreatIcon size="xs" /> View
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Tournament */}
          <Link to="/tournament" className="block">
            <Card className="game-card hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer h-full relative overflow-hidden">
              {/* Special tournament glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/10 animate-pulse" />
              <CardContent className="p-2.5 sm:p-6 flex flex-col items-center justify-center text-center aspect-square sm:aspect-auto relative">
                <div className="w-10 h-10 sm:w-20 sm:h-20 bg-gradient-to-br from-amber-400 to-orange-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-1.5 sm:mb-3 shadow-lg">
                  <Crown className="w-5 h-5 sm:w-10 sm:h-10 text-white" />
                </div>
                <h3 className="text-sm sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400 mb-1 sm:mb-2">
                  Tournament
                </h3>
                <p className="text-white/70 text-[10px] sm:text-sm mb-2 sm:mb-4 hidden sm:block line-clamp-2">
                  Champions League
                </p>
                <Button className="w-full text-xs sm:text-base py-1.5 sm:py-2.5 font-bold h-auto bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                  <Trophy className="w-3 h-3 mr-1" /> Enter
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Leaderboard */}
          <Link to="/leaderboard" className="block">
            <Card className="game-card hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer h-full">
              <CardContent className="p-2.5 sm:p-6 flex flex-col items-center justify-center text-center aspect-square sm:aspect-auto">
                <div className="w-10 h-10 sm:w-20 sm:h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-1.5 sm:mb-3 shadow-lg">
                  <Trophy className="w-5 h-5 sm:w-10 sm:h-10 text-white" />
                </div>
                <h3 className="text-sm sm:text-2xl font-bold text-white mb-1 sm:mb-2">Ranks</h3>
                <p className="text-white/70 text-[10px] sm:text-sm mb-2 sm:mb-4 hidden sm:block line-clamp-2">
                  Compete for $LAB rewards!
                </p>
                <Button className="doge-button w-full text-xs sm:text-base py-1.5 sm:py-2.5 font-bold h-auto">
                  <Trophy className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Compete
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Marketplace */}
          <Link to="/marketplace" className="block">
            <Card className="game-card hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer h-full relative overflow-hidden">
              <div className="absolute top-2 right-2 px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-[10px] text-yellow-400 font-medium">
                NEW
              </div>
              <CardContent className="p-2.5 sm:p-6 flex flex-col items-center justify-center text-center aspect-square sm:aspect-auto">
                <div className="w-10 h-10 sm:w-20 sm:h-20 bg-gradient-to-br from-yellow-400 to-sky-500 rounded-xl sm:rounded-2xl flex items-center justify-center mb-1.5 sm:mb-3 shadow-lg">
                  <Store className="w-5 h-5 sm:w-10 sm:h-10 text-white" />
                </div>
                <h3 className="text-sm sm:text-2xl font-bold text-white mb-1 sm:mb-2">Market</h3>
                <p className="text-white/70 text-[10px] sm:text-sm mb-2 sm:mb-4 hidden sm:block line-clamp-2">
                  Buy & sell treats
                </p>
                <Button className="w-full text-xs sm:text-base py-1.5 sm:py-2.5 font-bold h-auto bg-gradient-to-r from-yellow-500 to-sky-500 text-slate-900">
                  <Store className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Browse
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Settings */}
          <Link to="/settings" className="block">
            <Card className="game-card hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer h-full">
              <CardContent className="p-2.5 sm:p-6 flex flex-col items-center justify-center text-center aspect-square sm:aspect-auto">
                <div className="w-10 h-10 sm:w-20 sm:h-20 bg-gradient-to-br from-slate-400 to-slate-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-1.5 sm:mb-3 shadow-lg">
                  <Settings className="w-5 h-5 sm:w-10 sm:h-10 text-white" />
                </div>
                <h3 className="text-sm sm:text-2xl font-bold text-white mb-1 sm:mb-2">Settings</h3>
                <p className="text-white/70 text-[10px] sm:text-sm mb-2 sm:mb-4 hidden sm:block line-clamp-2">
                  Manage your account
                </p>
                <Button className="doge-button w-full text-xs sm:text-base py-1.5 sm:py-2.5 font-bold h-auto">
                  <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Manage
                </Button>
              </CardContent>
            </Card>
          </Link>
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
                Connect Your Wallet to Get Started!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="text-center p-6 bg-gradient-to-br from-green-400/30 to-emerald-500/20 rounded-3xl border-2 border-green-300/50">
                  <h4 className="font-bold text-2xl mb-3 playful-title text-white bubble-text">For Everyone</h4>
                  <ul className="text-white/90 space-y-2 playful-text text-lg">
                    <li>• Play for fun & advance levels</li>
                    <li>• Mix unlimited Dogetreats</li>
                    <li>• Unlock new ingredients</li>
                    <li>• Enjoy the full experience!</li>
                  </ul>
                </div>
                <div className="text-center p-6 bg-gradient-to-br from-yellow-400/30 to-orange-500/20 rounded-3xl border-2 border-yellow-300/50">
                  <h4 className="font-bold text-2xl mb-3 playful-title text-white bubble-text">For NFT Holders</h4>
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
                Need Help Understanding the Game?
              </h3>
              <p className="text-white/90 mb-6 text-lg">
                Learn all the game mechanics, strategies, and tips!
              </p>
              <Button
                onClick={() => window.open('/game-mechanisms.html', '_blank')}
                className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-bold py-4 px-8 text-xl rounded-xl shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl"
              >
                How it Works
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-16">
          <p className="text-yellow-500 text-sm playful-text bubble-text">
            Built with love for the Dogecoin community | Much wow, such science!
          </p>
        </div>
      </div>
      
      {/* Music Player */}
      <MusicPlayer />
      
      {/* Scientist Chat */}
      <ScientistChat />
      
      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-700 relative">
            {/* Close button */}
            <button 
              onClick={() => { setShowAuthModal(false); setShowGuestSignup(false); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {!showGuestSignup ? (
              <>
                {/* Icon */}
                <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Beaker className="w-8 h-8 text-white" />
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-white text-center mb-2">
                  Join the Lab!
                </h3>

                {/* Description */}
                <p className="text-slate-300 text-sm text-center mb-6">
                  Connect your wallet or sign up to start mixing treats and earning points!
                </p>

                {/* Options */}
                <div className="space-y-3">
                  {/* Connect Wallet */}
                  <div className="connect-wallet-wrapper">
                    <ConnectButton.Custom>
                      {({ openConnectModal }) => (
                        <button
                          onClick={() => {
                            setShowAuthModal(false);
                            openConnectModal();
                          }}
                          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold hover:from-blue-600 hover:to-indigo-600 transition-colors flex items-center justify-center gap-2"
                        >
                          <Wallet className="w-5 h-5" />
                          Connect Wallet
                        </button>
                      )}
                    </ConnectButton.Custom>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-slate-600" />
                    <span className="text-slate-400 text-sm">or</span>
                    <div className="flex-1 h-px bg-slate-600" />
                  </div>
                  
                  {/* Guest Sign Up */}
                  <button
                    onClick={() => setShowGuestSignup(true)}
                    className="w-full py-3 px-4 rounded-xl bg-slate-700 text-white font-semibold hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-5 h-5" />
                    Sign Up as Guest
                  </button>
                </div>

                <p className="text-slate-400 text-xs text-center mt-4">
                  NFT holders get bonus points and VIP status!
                </p>
              </>
            ) : (
              <>
                {/* Guest Signup Form */}
                <button 
                  onClick={() => setShowGuestSignup(false)}
                  className="text-slate-400 hover:text-white transition-colors mb-4 flex items-center gap-1 text-sm"
                >
                  ← Back
                </button>

                <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <UserPlus className="w-7 h-7 text-white" />
                </div>

                <h3 className="text-lg font-bold text-white text-center mb-2">
                  Create Guest Account
                </h3>

                <p className="text-slate-300 text-xs text-center mb-4">
                  Choose a username to get started
                </p>

                <div className="space-y-4">
                  <div>
                    <Input
                      type="text"
                      placeholder="Enter username"
                      value={guestUsername}
                      onChange={(e) => setGuestUsername(e.target.value)}
                      className="w-full bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                      maxLength={20}
                    />
                    {guestSignupError && (
                      <p className="text-red-400 text-xs mt-1">{guestSignupError}</p>
                    )}
                  </div>

                  <button
                    onClick={handleGuestSignup}
                    disabled={guestSignupLoading || !guestUsername}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold hover:from-emerald-600 hover:to-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {guestSignupLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Create Account
                      </>
                    )}
                  </button>
                </div>

                <p className="text-slate-400 text-xs text-center mt-4">
                  You can connect a wallet later to verify NFT ownership
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MainMenu;