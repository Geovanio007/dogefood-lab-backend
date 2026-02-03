import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useGame } from '../contexts/GameContext';
import { useAudio } from '../contexts/AudioContext';
import { useMusic } from '../contexts/MusicContext';
import { useTelegram } from '../contexts/TelegramContext';
import { useNFTVerification } from '../hooks/useNFTVerification';
import { NotificationSettings } from './NotificationPrompt';
import AutoMixerSubscription from './AutoMixerSubscription';
import { 
  ArrowLeft, 
  Volume2, 
  VolumeX, 
  Palette, 
  Zap, 
  Settings as SettingsIcon, 
  Play, 
  Pause, 
  User, 
  Edit2, 
  Check, 
  X, 
  Bell, 
  Music,
  Bot,
  Sparkles,
  Crown,
  Shield,
  Info,
  Moon,
  Sun
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Settings = () => {
  const { address, isConnected } = useAccount();
  const { isTelegram, telegramUser } = useTelegram();
  const { isNFTHolder: gameNFTHolder, dispatch } = useGame();
  const { isNFTHolder: nftVerifiedHolder, nftBalance, vipBonusCredited } = useNFTVerification();
  const location = useLocation();
  const [playerNFTStatus, setPlayerNFTStatus] = useState(false);
  const [playerData, setPlayerData] = useState(null);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  
  // Get initial tab from navigation state or default to 'general'
  const [activeTab, setActiveTab] = useState(() => {
    return location.state?.tab || 'general';
  });
  
  // Update tab when location state changes
  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage or system preference
    const saved = localStorage.getItem('dogefood_dark_mode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  const { 
    soundEnabled, 
    musicVolume, 
    effectsVolume,
    isMusicPlaying,
    setSoundEnabled,
    setMusicVolume,
    setEffectsVolume,
    startBackgroundMusic,
    stopBackgroundMusic,
    playClick,
    playSuccess
  } = useAudio();

  // Music context for background music enabled setting
  const { musicEnabled, setMusicEnabled } = useMusic();

  const [visualSettings, setVisualSettings] = useState({
    particleEffects: true,
    reducedMotion: false,
    autoMix: false,
    notifications: true,
  });

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('dogefood_dark_mode', isDarkMode.toString());
  }, [isDarkMode]);

  // Get effective player address
  const getEffectiveAddress = () => {
    if (address) return address;
    if (isTelegram && telegramUser?.id) return `TG_${telegramUser.id}`;
    const storedPlayer = localStorage.getItem('dogefood_player');
    if (storedPlayer) {
      try {
        const player = JSON.parse(storedPlayer);
        return player.guest_id || player.id || player.address;
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  const effectiveAddress = getEffectiveAddress();

  // Fetch player data including NFT status
  useEffect(() => {
    const fetchPlayerData = async () => {
      if (!effectiveAddress) return;
      
      try {
        const response = await fetch(`${BACKEND_URL}/api/player/${effectiveAddress}`);
        if (response.ok) {
          const data = await response.json();
          setPlayerData(data);
          setPlayerNFTStatus(data.is_nft_holder === true);
          setNewUsername(data.nickname || '');
          if (dispatch) {
            dispatch({ type: 'SET_NFT_HOLDER', payload: data.is_nft_holder === true });
          }
        }
      } catch (error) {
        console.error('Error fetching player data:', error);
      }
    };
    
    fetchPlayerData();
  }, [effectiveAddress, dispatch]);

  // Use the fetched NFT status or the one from GameContext or direct verification
  const effectiveNFTStatus = nftVerifiedHolder || playerNFTStatus || gameNFTHolder;

  // Handle username update
  const handleSaveUsername = async () => {
    if (!newUsername.trim()) {
      setUsernameError('Username is required');
      return;
    }
    
    if (newUsername.length < 3 || newUsername.length > 20) {
      setUsernameError('Username must be 3-20 characters');
      return;
    }
    
    if (!newUsername.replace(/_/g, '').match(/^[a-zA-Z0-9]+$/)) {
      setUsernameError('Only letters, numbers, and underscores allowed');
      return;
    }
    
    setSavingUsername(true);
    setUsernameError('');
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/player/${effectiveAddress}/update-username?username=${encodeURIComponent(newUsername.trim())}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPlayerData(prev => ({ ...prev, nickname: newUsername.trim() }));
        setIsEditingUsername(false);
        playSuccess();
      } else {
        const errorData = await response.json();
        setUsernameError(errorData.detail || 'Failed to update username');
      }
    } catch (error) {
      setUsernameError('Failed to update username');
    } finally {
      setSavingUsername(false);
    }
  };

  const cancelUsernameEdit = () => {
    setIsEditingUsername(false);
    setNewUsername(playerData?.nickname || '');
    setUsernameError('');
  };

  const updateVisualSetting = (key, value) => {
    setVisualSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleMusicToggle = async () => {
    if (isMusicPlaying) {
      stopBackgroundMusic();
    } else {
      await startBackgroundMusic();
    }
  };

  const handleSoundToggle = (checked) => {
    setSoundEnabled(checked);
    if (!checked) {
      stopBackgroundMusic();
    }
  };

  const handleMusicVolumeChange = (value) => {
    setMusicVolume(value[0]);
  };

  const handleEffectsVolumeChange = (value) => {
    setEffectsVolume(value[0]);
  };

  const testEffectSound = () => {
    playSuccess();
  };

  const resetSettings = () => {
    setSoundEnabled(true);
    setMusicVolume(75);
    setEffectsVolume(80);
    setVisualSettings({
      particleEffects: true,
      reducedMotion: false,
      autoMix: false,
      notifications: true,
    });
    playClick();
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50'}`}>
      {/* Header */}
      <div className={`${isDarkMode ? 'bg-gradient-to-r from-slate-800 to-slate-700' : 'bg-gradient-to-r from-sky-500 to-blue-600'} text-white`}>
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="sm" onClick={playClick} className="text-white hover:bg-white/20">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <SettingsIcon className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Settings</h1>
                  <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-sky-100'}`}>Customize your DogeFood Lab experience</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Dark Mode Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="text-white hover:bg-white/20"
                data-testid="dark-mode-toggle"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
              
              {/* Account Status Badge */}
              {effectiveNFTStatus && (
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-400 to-sky-500 rounded-full shadow-lg">
                  <Crown className="w-5 h-5" />
                  <span className="font-semibold">VIP Scientist</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={`grid w-full grid-cols-4 p-1 rounded-2xl shadow-sm ${isDarkMode ? 'bg-slate-800' : 'bg-white/80 backdrop-blur-sm'}`}>
            <TabsTrigger 
              value="general" 
              className={`rounded-xl transition-all ${isDarkMode ? 'data-[state=active]:bg-sky-600 data-[state=active]:text-white text-slate-300' : 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:to-blue-500 data-[state=active]:text-white'}`}
              data-testid="tab-general"
            >
              <SettingsIcon className="w-4 h-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger 
              value="auto-mixer" 
              className={`rounded-xl transition-all ${isDarkMode ? 'data-[state=active]:bg-sky-600 data-[state=active]:text-white text-slate-300' : 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:to-blue-500 data-[state=active]:text-white'}`}
              data-testid="tab-auto-mixer"
            >
              <Bot className="w-4 h-4 mr-2" />
              Auto-Mixer
            </TabsTrigger>
            <TabsTrigger 
              value="audio" 
              className={`rounded-xl transition-all ${isDarkMode ? 'data-[state=active]:bg-sky-600 data-[state=active]:text-white text-slate-300' : 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:to-blue-500 data-[state=active]:text-white'}`}
              data-testid="tab-audio"
            >
              <Music className="w-4 h-4 mr-2" />
              Audio
            </TabsTrigger>
            <TabsTrigger 
              value="account" 
              className={`rounded-xl transition-all ${isDarkMode ? 'data-[state=active]:bg-sky-600 data-[state=active]:text-white text-slate-300' : 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:to-blue-500 data-[state=active]:text-white'}`}
              data-testid="tab-account"
            >
              <User className="w-4 h-4 mr-2" />
              Account
            </TabsTrigger>
          </TabsList>

          {/* General Settings Tab */}
          <TabsContent value="general" className="space-y-6">
            {/* Dark Mode Card */}
            <Card className={`border-0 shadow-lg ${isDarkMode ? 'bg-slate-800' : 'bg-white/90 backdrop-blur-sm'}`}>
              <CardHeader>
                <CardTitle className={`flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  {isDarkMode ? <Moon className="w-5 h-5 text-sky-400" /> : <Sun className="w-5 h-5 text-sky-600" />}
                  Appearance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`flex items-center justify-between p-4 rounded-xl ${isDarkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                  <div>
                    <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Dark Mode</div>
                    <div className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Toggle between light and dark themes</div>
                  </div>
                  <Switch
                    checked={isDarkMode}
                    onCheckedChange={setIsDarkMode}
                    data-testid="dark-mode-switch"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card className={`border-0 shadow-lg ${isDarkMode ? 'bg-slate-800' : 'bg-white/90 backdrop-blur-sm'}`}>
              <CardHeader>
                <CardTitle className={`flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  <Bell className={`w-5 h-5 ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`} />
                  Notifications
                </CardTitle>
                <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-muted-foreground'}`}>
                  Configure your notification preferences
                </p>
              </CardHeader>
              <CardContent>
                <NotificationSettings isDarkMode={isDarkMode} />
              </CardContent>
            </Card>

            {/* Visual Settings */}
            <Card className={`border-0 shadow-lg ${isDarkMode ? 'bg-slate-800' : 'bg-white/90 backdrop-blur-sm'}`}>
              <CardHeader>
                <CardTitle className={`flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  <Palette className={`w-5 h-5 ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`} />
                  Visual Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className={`flex items-center justify-between p-4 rounded-xl ${isDarkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                  <div>
                    <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Particle Effects</div>
                    <div className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Show floating particles and animations</div>
                  </div>
                  <Switch
                    checked={visualSettings.particleEffects}
                    onCheckedChange={(checked) => updateVisualSetting('particleEffects', checked)}
                    data-testid="particle-effects-toggle"
                  />
                </div>
                
                <div className={`flex items-center justify-between p-4 rounded-xl ${isDarkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                  <div>
                    <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Reduced Motion</div>
                    <div className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Minimize animations for better performance</div>
                  </div>
                  <Switch
                    checked={visualSettings.reducedMotion}
                    onCheckedChange={(checked) => updateVisualSetting('reducedMotion', checked)}
                    data-testid="reduced-motion-toggle"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Gameplay Settings */}
            <Card className={`border-0 shadow-lg ${isDarkMode ? 'bg-slate-800' : 'bg-white/90 backdrop-blur-sm'}`}>
              <CardHeader>
                <CardTitle className={`flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  <Zap className={`w-5 h-5 ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`} />
                  Gameplay
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className={`flex items-center justify-between p-4 rounded-xl ${isDarkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                  <div>
                    <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Quick-Mix Mode</div>
                    <div className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Auto-start mixing when ingredients selected</div>
                  </div>
                  <Switch
                    checked={visualSettings.autoMix}
                    onCheckedChange={(checked) => updateVisualSetting('autoMix', checked)}
                    data-testid="auto-mix-toggle"
                  />
                </div>
                
                <div className={`flex items-center justify-between p-4 rounded-xl ${isDarkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                  <div>
                    <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Push Notifications</div>
                    <div className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Get notified about events and features</div>
                  </div>
                  <Switch
                    checked={visualSettings.notifications}
                    onCheckedChange={(checked) => updateVisualSetting('notifications', checked)}
                    data-testid="notifications-toggle"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Auto-Mixer Tab */}
          <TabsContent value="auto-mixer" className="space-y-6">
            {effectiveAddress ? (
              <AutoMixerSubscription 
                playerAddress={effectiveAddress}
                playerNickname={playerData?.nickname}
                isDarkMode={isDarkMode}
              />
            ) : (
              <AutoMixerSubscription 
                playerAddress={null}
                playerNickname={null}
                isDarkMode={isDarkMode}
              />
            )}
          </TabsContent>

          {/* Audio Settings Tab */}
          <TabsContent value="audio" className="space-y-6">
            <Card className={`border-0 shadow-lg ${isDarkMode ? 'bg-slate-800' : 'bg-white/90 backdrop-blur-sm'}`}>
              <CardHeader>
                <CardTitle className={`flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  {soundEnabled ? <Volume2 className={`w-5 h-5 ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`} /> : <VolumeX className="w-5 h-5 text-slate-400" />}
                  Audio Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Music On/Off Toggle */}
                <div className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? 'bg-purple-900/30 border-purple-700' : 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200'}`}>
                  <div className="flex items-center gap-3">
                    <Music className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                    <div>
                      <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Background Music</div>
                      <div className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Play music when entering the game</div>
                    </div>
                  </div>
                  <Switch
                    data-testid="music-enabled-toggle"
                    checked={musicEnabled}
                    onCheckedChange={setMusicEnabled}
                  />
                </div>
                
                <div className={`flex items-center justify-between p-4 rounded-xl ${isDarkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                  <div>
                    <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Sound Effects</div>
                    <div className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Enable all game sounds and music</div>
                  </div>
                  <Switch
                    checked={soundEnabled}
                    onCheckedChange={handleSoundToggle}
                    data-testid="sound-enabled-toggle"
                  />
                </div>
                
                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Background Music Volume</div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>{musicVolume}%</span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleMusicToggle}
                        disabled={!soundEnabled}
                        className={isDarkMode ? 'border-slate-600 hover:bg-slate-600' : ''}
                        data-testid="play-music-btn"
                      >
                        {isMusicPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <Slider
                    value={[musicVolume]}
                    onValueChange={handleMusicVolumeChange}
                    max={100}
                    step={5}
                    disabled={!soundEnabled}
                    className="w-full"
                  />
                </div>
                
                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Effects Volume</div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>{effectsVolume}%</span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={testEffectSound}
                        disabled={!soundEnabled}
                        className={isDarkMode ? 'border-slate-600 hover:bg-slate-600' : ''}
                        data-testid="test-sound-btn"
                      >
                        Test
                      </Button>
                    </div>
                  </div>
                  <Slider
                    value={[effectsVolume]}
                    onValueChange={handleEffectsVolumeChange}
                    max={100}
                    step={5}
                    disabled={!soundEnabled}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            {/* Profile Card */}
            <Card className={`border-0 shadow-lg overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-white/90 backdrop-blur-sm'}`}>
              <div className={`h-24 ${isDarkMode ? 'bg-gradient-to-r from-slate-700 to-slate-600' : 'bg-gradient-to-r from-sky-500 to-blue-600'}`} />
              <CardContent className="relative pt-0">
                <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-12">
                  <div className={`w-24 h-24 rounded-2xl flex items-center justify-center text-4xl shadow-xl border-4 ${isDarkMode ? 'bg-gradient-to-br from-sky-600 to-blue-700 border-slate-800' : 'bg-gradient-to-br from-sky-400 to-blue-500 border-white'}`}>
                    {playerData?.selected_character === 'max' ? '🐕' : 
                     playerData?.selected_character === 'rex' ? '🦮' : 
                     playerData?.selected_character === 'luna' ? '🐩' : '👨‍🔬'}
                  </div>
                  <div className="flex-1 pb-2">
                    {/* Username Section */}
                    {isEditingUsername ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            placeholder="Enter username"
                            className={`flex-1 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : ''}`}
                            maxLength={20}
                            data-testid="username-input"
                          />
                          <Button 
                            size="sm" 
                            onClick={handleSaveUsername}
                            disabled={savingUsername}
                            className="bg-emerald-500 hover:bg-emerald-600"
                            data-testid="save-username-btn"
                          >
                            {savingUsername ? '...' : <Check className="w-4 h-4" />}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={cancelUsernameEdit}
                            className={isDarkMode ? 'border-slate-600 hover:bg-slate-700' : ''}
                            data-testid="cancel-username-btn"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        {usernameError && (
                          <p className="text-red-500 text-xs">{usernameError}</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          {playerData?.nickname || 'Anonymous Scientist'}
                        </h2>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setIsEditingUsername(true)}
                          className={isDarkMode ? 'hover:bg-slate-700' : ''}
                          data-testid="edit-username-btn"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    <p className={`text-sm mt-1 font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {effectiveAddress ? `${effectiveAddress.slice(0, 8)}...${effectiveAddress.slice(-6)}` : 'Not connected'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className={`border-0 shadow-lg ${effectiveNFTStatus ? (isDarkMode ? 'bg-cyan-900/30' : 'bg-gradient-to-br from-cyan-50 to-sky-100') : (isDarkMode ? 'bg-slate-800' : 'bg-white/90')}`}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${effectiveNFTStatus ? 'bg-gradient-to-br from-cyan-400 to-sky-500' : (isDarkMode ? 'bg-slate-700' : 'bg-slate-200')}`}>
                      {effectiveNFTStatus ? <Crown className="w-6 h-6 text-white" /> : <Shield className={`w-6 h-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />}
                    </div>
                    <div>
                      <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Account Status</h3>
                      <p className={`text-sm ${effectiveNFTStatus ? (isDarkMode ? 'text-sky-300' : 'text-sky-700') : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`}>
                        {effectiveNFTStatus ? 'VIP Scientist (NFT Holder)' : 'Regular Scientist'}
                      </p>
                    </div>
                  </div>
                  {effectiveNFTStatus && (
                    <div className={`mt-4 p-3 rounded-lg text-sm ${isDarkMode ? 'bg-sky-900/50 text-sky-300' : 'bg-sky-100 text-sky-800'}`}>
                      <Sparkles className="w-4 h-4 inline mr-1" />
                      500 Bonus Points + VIP Perks Active
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className={`border-0 shadow-lg ${isDarkMode ? 'bg-slate-800' : 'bg-white/90'}`}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500">
                      <Info className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Account Type</h3>
                      <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {address ? 'Wallet Connected' : 
                         isTelegram ? 'Telegram User' : 
                         effectiveAddress?.startsWith('guest_') ? 'Guest Account' : 
                         'Not Connected'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Player Stats */}
            {playerData && (
              <Card className={`border-0 shadow-lg ${isDarkMode ? 'bg-slate-800' : 'bg-white/90 backdrop-blur-sm'}`}>
                <CardHeader>
                  <CardTitle className={isDarkMode ? 'text-white' : 'text-slate-800'}>Your Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className={`text-center p-4 rounded-xl ${isDarkMode ? 'bg-sky-900/30' : 'bg-sky-50'}`}>
                      <div className={`text-3xl font-bold ${isDarkMode ? 'text-sky-300' : 'text-sky-600'}`}>{playerData.level || 1}</div>
                      <div className={`text-sm ${isDarkMode ? 'text-sky-400' : 'text-sky-700'}`}>Level</div>
                    </div>
                    <div className={`text-center p-4 rounded-xl ${isDarkMode ? 'bg-emerald-900/30' : 'bg-emerald-50'}`}>
                      <div className={`text-3xl font-bold ${isDarkMode ? 'text-emerald-300' : 'text-emerald-600'}`}>{playerData.points || 0}</div>
                      <div className={`text-sm ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>Points</div>
                    </div>
                    <div className={`text-center p-4 rounded-xl ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                      <div className={`text-3xl font-bold ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>{playerData.experience || 0}</div>
                      <div className={`text-sm ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>XP</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card className={`border-0 shadow-lg ${isDarkMode ? 'bg-slate-800' : 'bg-white/90 backdrop-blur-sm'}`}>
              <CardContent className="p-6">
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={playClick}
                    className={isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : ''}
                    data-testid="export-data-btn"
                  >
                    Export Data
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={resetSettings}
                    className={isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : ''}
                    data-testid="reset-settings-btn"
                  >
                    Reset Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className={`mt-8 text-center text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
          <p>DogeFood Lab v1.0.0 Beta • Built with love for the Dogecoin community</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
