import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  Info
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Settings = () => {
  const { address, isConnected } = useAccount();
  const { isTelegram, telegramUser } = useTelegram();
  const { isNFTHolder: gameNFTHolder, dispatch } = useGame();
  const { isNFTHolder: nftVerifiedHolder, nftBalance, vipBonusCredited } = useNFTVerification();
  const [playerNFTStatus, setPlayerNFTStatus] = useState(false);
  const [playerData, setPlayerData] = useState(null);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  
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
    darkMode: false,
    autoMix: false,
    notifications: true,
  });

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
      darkMode: false,
      autoMix: false,
      notifications: true,
    });
    playClick();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white">
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
                  <p className="text-amber-100 text-sm">Customize your DogeFood Lab experience</p>
                </div>
              </div>
            </div>
            
            {/* Account Status Badge */}
            {effectiveNFTStatus && (
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full shadow-lg">
                <Crown className="w-5 h-5" />
                <span className="font-semibold">VIP Scientist</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/80 backdrop-blur-sm p-1 rounded-2xl shadow-sm">
            <TabsTrigger 
              value="general" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white rounded-xl transition-all"
              data-testid="tab-general"
            >
              <SettingsIcon className="w-4 h-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger 
              value="auto-mixer" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white rounded-xl transition-all"
              data-testid="tab-auto-mixer"
            >
              <Bot className="w-4 h-4 mr-2" />
              Auto-Mixer
            </TabsTrigger>
            <TabsTrigger 
              value="audio" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white rounded-xl transition-all"
              data-testid="tab-audio"
            >
              <Music className="w-4 h-4 mr-2" />
              Audio
            </TabsTrigger>
            <TabsTrigger 
              value="account" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white rounded-xl transition-all"
              data-testid="tab-account"
            >
              <User className="w-4 h-4 mr-2" />
              Account
            </TabsTrigger>
          </TabsList>

          {/* General Settings Tab */}
          <TabsContent value="general" className="space-y-6">
            {/* Notifications */}
            <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Bell className="w-5 h-5 text-amber-600" />
                  Notifications
                </CardTitle>
                <CardDescription>
                  Configure your notification preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NotificationSettings />
              </CardContent>
            </Card>

            {/* Visual Settings */}
            <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Palette className="w-5 h-5 text-amber-600" />
                  Visual Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div>
                    <div className="font-medium text-slate-800">Particle Effects</div>
                    <div className="text-sm text-slate-500">Show floating particles and animations</div>
                  </div>
                  <Switch
                    checked={visualSettings.particleEffects}
                    onCheckedChange={(checked) => updateVisualSetting('particleEffects', checked)}
                    data-testid="particle-effects-toggle"
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div>
                    <div className="font-medium text-slate-800">Reduced Motion</div>
                    <div className="text-sm text-slate-500">Minimize animations for better performance</div>
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
            <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Zap className="w-5 h-5 text-amber-600" />
                  Gameplay
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div>
                    <div className="font-medium text-slate-800">Quick-Mix Mode</div>
                    <div className="text-sm text-slate-500">Auto-start mixing when ingredients selected</div>
                  </div>
                  <Switch
                    checked={visualSettings.autoMix}
                    onCheckedChange={(checked) => updateVisualSetting('autoMix', checked)}
                    data-testid="auto-mix-toggle"
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div>
                    <div className="font-medium text-slate-800">Push Notifications</div>
                    <div className="text-sm text-slate-500">Get notified about events and features</div>
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
              />
            ) : (
              <Card className="border-2 border-dashed border-slate-300">
                <CardContent className="py-12 text-center">
                  <Bot className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <h3 className="text-lg font-semibold text-slate-600 mb-2">Connect to Access Auto-Mixer</h3>
                  <p className="text-slate-500">Please connect your wallet or sign in to use the Auto-Mixer feature</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Audio Settings Tab */}
          <TabsContent value="audio" className="space-y-6">
            <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  {soundEnabled ? <Volume2 className="w-5 h-5 text-amber-600" /> : <VolumeX className="w-5 h-5 text-slate-400" />}
                  Audio Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Music On/Off Toggle */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                  <div className="flex items-center gap-3">
                    <Music className="w-5 h-5 text-purple-600" />
                    <div>
                      <div className="font-medium text-slate-800">Background Music</div>
                      <div className="text-sm text-slate-500">Play music when entering the game</div>
                    </div>
                  </div>
                  <Switch
                    data-testid="music-enabled-toggle"
                    checked={musicEnabled}
                    onCheckedChange={setMusicEnabled}
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div>
                    <div className="font-medium text-slate-800">Sound Effects</div>
                    <div className="text-sm text-slate-500">Enable all game sounds and music</div>
                  </div>
                  <Switch
                    checked={soundEnabled}
                    onCheckedChange={handleSoundToggle}
                    data-testid="sound-enabled-toggle"
                  />
                </div>
                
                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-medium text-slate-800">Background Music Volume</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">{musicVolume}%</span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleMusicToggle}
                        disabled={!soundEnabled}
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
                
                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-medium text-slate-800">Effects Volume</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">{effectsVolume}%</span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={testEffectSound}
                        disabled={!soundEnabled}
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
            <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm overflow-hidden">
              <div className="h-24 bg-gradient-to-r from-amber-500 to-orange-600" />
              <CardContent className="relative pt-0">
                <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-12">
                  <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center text-4xl shadow-xl border-4 border-white">
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
                            className="flex-1"
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
                        <h2 className="text-2xl font-bold text-slate-800">
                          {playerData?.nickname || 'Anonymous Scientist'}
                        </h2>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setIsEditingUsername(true)}
                          data-testid="edit-username-btn"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    <p className="text-slate-500 text-sm mt-1 font-mono">
                      {effectiveAddress ? `${effectiveAddress.slice(0, 8)}...${effectiveAddress.slice(-6)}` : 'Not connected'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className={`border-0 shadow-lg ${effectiveNFTStatus ? 'bg-gradient-to-br from-yellow-50 to-amber-100' : 'bg-white/90'}`}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${effectiveNFTStatus ? 'bg-gradient-to-br from-yellow-400 to-amber-500' : 'bg-slate-200'}`}>
                      {effectiveNFTStatus ? <Crown className="w-6 h-6 text-white" /> : <Shield className="w-6 h-6 text-slate-500" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">Account Status</h3>
                      <p className={`text-sm ${effectiveNFTStatus ? 'text-amber-700' : 'text-slate-500'}`}>
                        {effectiveNFTStatus ? 'VIP Scientist (NFT Holder)' : 'Regular Scientist'}
                      </p>
                    </div>
                  </div>
                  {effectiveNFTStatus && (
                    <div className="mt-4 p-3 bg-yellow-100 rounded-lg text-sm text-amber-800">
                      <Sparkles className="w-4 h-4 inline mr-1" />
                      500 Bonus Points + VIP Perks Active
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-white/90">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500">
                      <Info className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">Account Type</h3>
                      <p className="text-sm text-slate-500">
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
              <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-slate-800">Your Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-amber-50 rounded-xl">
                      <div className="text-3xl font-bold text-amber-600">{playerData.level || 1}</div>
                      <div className="text-sm text-amber-700">Level</div>
                    </div>
                    <div className="text-center p-4 bg-emerald-50 rounded-xl">
                      <div className="text-3xl font-bold text-emerald-600">{playerData.points || 0}</div>
                      <div className="text-sm text-emerald-700">Points</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-xl">
                      <div className="text-3xl font-bold text-blue-600">{playerData.experience || 0}</div>
                      <div className="text-sm text-blue-700">XP</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" onClick={playClick} data-testid="export-data-btn">
                    Export Data
                  </Button>
                  <Button variant="outline" size="sm" onClick={resetSettings} data-testid="reset-settings-btn">
                    Reset Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-slate-500">
          <p>DogeFood Lab v1.0.0 Beta • Built with love for the Dogecoin community</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
