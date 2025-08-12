import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { useGame } from '../contexts/GameContext';
import { ArrowLeft, Volume2, VolumeX, Palette, Zap, Settings as SettingsIcon } from 'lucide-react';

const Settings = () => {
  const { isNFTHolder } = useGame();
  const [settings, setSettings] = useState({
    soundEnabled: true,
    musicVolume: [75],
    effectsVolume: [80],
    autoMix: false,
    particleEffects: true,
    reducedMotion: false,
    darkMode: false,
    notifications: true,
  });

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetSettings = () => {
    setSettings({
      soundEnabled: true,
      musicVolume: [75],
      effectsVolume: [80],
      autoMix: false,
      particleEffects: true,
      reducedMotion: false,
      darkMode: false,
      notifications: true,
    });
  };

  return (
    <div className="lab-container min-h-screen p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Menu
            </Button>
          </Link>
          <h1 className="text-4xl font-bold doge-gradient">Settings ⚙️</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Audio Settings */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {settings.soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              Audio Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Sound Effects</div>
                <div className="text-sm text-gray-600">Enable mixing sounds and UI feedback</div>
              </div>
              <Switch
                checked={settings.soundEnabled}
                onCheckedChange={(checked) => updateSetting('soundEnabled', checked)}
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium">Background Music Volume</div>
                <span className="text-sm text-gray-600">{settings.musicVolume[0]}%</span>
              </div>
              <Slider
                value={settings.musicVolume}
                onValueChange={(value) => updateSetting('musicVolume', value)}
                max={100}
                step={5}
                disabled={!settings.soundEnabled}
                className="w-full"
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium">Effects Volume</div>
                <span className="text-sm text-gray-600">{settings.effectsVolume[0]}%</span>
              </div>
              <Slider
                value={settings.effectsVolume}
                onValueChange={(value) => updateSetting('effectsVolume', value)}
                max={100}
                step={5}
                disabled={!settings.soundEnabled}
                className="w-full"
              />
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
                <div className="text-sm text-gray-600">Show floating particles and animations</div>
              </div>
              <Switch
                checked={settings.particleEffects}
                onCheckedChange={(checked) => updateSetting('particleEffects', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Reduced Motion</div>
                <div className="text-sm text-gray-600">Minimize animations for better performance</div>
              </div>
              <Switch
                checked={settings.reducedMotion}
                onCheckedChange={(checked) => updateSetting('reducedMotion', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Dark Mode</div>
                <div className="text-sm text-gray-600">Switch to darker theme (Coming Soon!)</div>
              </div>
              <Switch
                checked={settings.darkMode}
                onCheckedChange={(checked) => updateSetting('darkMode', checked)}
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
                <div className="text-sm text-gray-600">Automatically start mixing when ingredients are selected</div>
              </div>
              <Switch
                checked={settings.autoMix}
                onCheckedChange={(checked) => updateSetting('autoMix', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Push Notifications</div>
                <div className="text-sm text-gray-600">Get notified about new features and events</div>
              </div>
              <Switch
                checked={settings.notifications}
                onCheckedChange={(checked) => updateSetting('notifications', checked)}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-white/20 rounded-xl">
                <div className="font-medium mb-2">Account Status</div>
                <div className="text-sm text-gray-600">
                  {isNFTHolder ? '🌟 VIP Scientist' : '👨‍🔬 Regular Scientist'}
                </div>
              </div>
              
              <div className="p-4 bg-white/20 rounded-xl">
                <div className="font-medium mb-2">Data Storage</div>
                <div className="text-sm text-gray-600">
                  Local browser storage
                </div>
              </div>
            </div>
            
            <div className="border-t border-white/20 pt-6">
              <div className="text-sm text-gray-600 mb-4">
                Your game progress is automatically saved to your connected wallet.
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="sm">
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
            <div className="text-6xl mb-4">🐕‍🦺</div>
            <p className="text-gray-700">
              A playful Web3 game inspired by Dogecoin culture. Mix, create, and compete!
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 text-sm">
              <div className="p-3 bg-white/20 rounded-lg">
                <div className="font-medium">Version</div>
                <div className="text-gray-600">1.0.0 Alpha</div>
              </div>
              <div className="p-3 bg-white/20 rounded-lg">
                <div className="font-medium">Network</div>
                <div className="text-gray-600">Ethereum Mainnet</div>
              </div>
              <div className="p-3 bg-white/20 rounded-lg">
                <div className="font-medium">Status</div>
                <div className="text-gray-600">🔴 Prototype</div>
              </div>
            </div>
            
            <div className="border-t border-white/20 pt-6 mt-6">
              <p className="text-xs text-gray-500">
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