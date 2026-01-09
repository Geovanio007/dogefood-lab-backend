import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { Input } from './ui/input';
import { useGame } from '../contexts/GameContext';
import { useAudio } from '../contexts/AudioContext';
import { useTelegram } from '../contexts/TelegramContext';
import { ArrowLeft, Volume2, VolumeX, Palette, Zap, Settings as SettingsIcon, Play, Pause, User, Edit2, Check, X } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Settings = () => {
  const { address, isConnected } = useAccount();
  const { isTelegram, telegramUser } = useTelegram();
  const { isNFTHolder, dispatch } = useGame();
  const [playerNFTStatus, setPlayerNFTStatus] = useState(false);
  const [playerData, setPlayerData] = useState(null);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  
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

  // Use the fetched NFT status or the one from GameContext
  const effectiveNFTStatus = playerNFTStatus || isNFTHolder;

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
    <div className="lab-container min-h-screen p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="outline" size="sm" onClick={playClick}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Menu
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-orange-600 dark:text-yellow-400" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>Settings ⚙️</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Audio Settings */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              Audio Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Sound Effects</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">Enable all game sounds and music</div>
              </div>
              <Switch
                checked={soundEnabled}
                onCheckedChange={handleSoundToggle}
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium">Background Music Volume</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300">{musicVolume}%</span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleMusicToggle}
                    disabled={!soundEnabled}
                    className="ml-2"
                  >
                    {isMusicPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isMusicPlaying ? 'Stop' : 'Play'}
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
              <p className="text-xs text-slate-500 mt-1">🎵 Cinematic lab background music</p>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium">Effects Volume</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300">{effectsVolume}%</span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={testEffectSound}
                    disabled={!soundEnabled}
                    className="ml-2"
                  >
                    🔊 Test
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
              <p className="text-xs text-slate-500 mt-1">🧪 Mix, collect, and UI feedback sounds</p>
            </div>
          </CardContent>
        </Card>

        {/* Visual Settings */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Visual Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Particle Effects</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">Show floating particles and animations</div>
              </div>
              <Switch
                checked={visualSettings.particleEffects}
                onCheckedChange={(checked) => updateVisualSetting('particleEffects', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Reduced Motion</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">Minimize animations for better performance</div>
              </div>
              <Switch
                checked={visualSettings.reducedMotion}
                onCheckedChange={(checked) => updateVisualSetting('reducedMotion', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Dark Mode</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">Switch to darker theme (Coming Soon!)</div>
              </div>
              <Switch
                checked={visualSettings.darkMode}
                onCheckedChange={(checked) => updateVisualSetting('darkMode', checked)}
                disabled={true}
              />
            </div>
          </CardContent>
        </Card>

        {/* Game Settings */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Gameplay Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Auto-Mix Mode</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">Automatically start mixing when ingredients are selected</div>
              </div>
              <Switch
                checked={visualSettings.autoMix}
                onCheckedChange={(checked) => updateVisualSetting('autoMix', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Push Notifications</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">Get notified about new features and events</div>
              </div>
              <Switch
                checked={visualSettings.notifications}
                onCheckedChange={(checked) => updateVisualSetting('notifications', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Account Settings */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Username Section - For Telegram and Guest users */}
            {effectiveAddress && (
              <div className="p-4 bg-white/20 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Username
                  </div>
                  {!isEditingUsername && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setIsEditingUsername(true)}
                      className="h-8 px-2"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                
                {isEditingUsername ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Enter username"
                        className="flex-1"
                        maxLength={20}
                      />
                      <Button 
                        size="sm" 
                        onClick={handleSaveUsername}
                        disabled={savingUsername}
                        className="bg-green-500 hover:bg-green-600"
                      >
                        {savingUsername ? '...' : <Check className="w-4 h-4" />}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={cancelUsernameEdit}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    {usernameError && (
                      <p className="text-red-500 text-xs">{usernameError}</p>
                    )}
                    <p className="text-xs text-slate-500">3-20 characters, letters, numbers, underscores only</p>
                  </div>
                ) : (
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    {playerData?.nickname || 'Not set - Click edit to set your username'}
                  </div>
                )}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-white/20 rounded-xl">
                <div className="font-medium mb-2">Account Status</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {effectiveNFTStatus ? '🌟 VIP Scientist' : '👨‍🔬 Regular Scientist'}
                </div>
              </div>
              
              <div className="p-4 bg-white/20 rounded-xl">
                <div className="font-medium mb-2">Account Type</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {address ? '🔗 Wallet Connected' : 
                   isTelegram ? '📱 Telegram User' : 
                   effectiveAddress?.startsWith('guest_') ? '👤 Guest Account' : 
                   'Not Connected'}
                </div>
              </div>
            </div>
            
            <div className="border-t border-white/20 pt-6">
              <div className="text-sm text-gray-600 mb-4">
                Your game progress is automatically saved to your account.
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={playClick}>
                  Export Data
                </Button>
                <Button variant="outline" size="sm" onClick={resetSettings}>
                  Reset Settings
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-center doge-gradient">About DogeFood Lab 🧪</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-slate-700 dark:text-slate-200">
              A playful Web3 game inspired by Dogecoin culture. Mix, create, and compete!
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 text-sm">
              <div className="p-3 bg-white/20 rounded-lg">
                <div className="font-medium">Version</div>
                <div className="text-slate-600 dark:text-slate-300">1.0.0 Beta</div>
              </div>
              <div className="p-3 bg-white/20 rounded-lg">
                <div className="font-medium">Network</div>
                <div className="text-slate-600 dark:text-slate-300">DogeOS</div>
              </div>
              <div className="p-3 bg-white/20 rounded-lg">
                <div className="font-medium">Status</div>
                <div className="text-slate-600 dark:text-slate-300">🟢 Beta</div>
              </div>
            </div>
            
            <div className="border-t border-white/20 pt-6 mt-6">
              <p className="text-xs text-slate-500 dark:text-slate-300">
                Built with React, Three.js, and Web3 technologies.<br />
                Much love to the Dogecoin community! 🚀
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
