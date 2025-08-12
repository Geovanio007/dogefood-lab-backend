import React, { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useWeb3 } from '../hooks/useWeb3';
import { useGame } from '../contexts/GameContext';
import { AlertTriangle, CheckCircle, Wifi } from 'lucide-react';

const WalletConnection = () => {
  const { address, isConnected, isCorrectNetwork, switchToDogeOS } = useWeb3();
  const { user, isNFTHolder, currentLevel, points } = useGame();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleNetworkSwitch = async () => {
    try {
      await switchToDogeOS();
    } catch (error) {
      console.error('Network switch failed:', error);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {/* Network Status Indicator */}
      {isConnected && (
        <div className="flex items-center gap-2">
          {isCorrectNetwork ? (
            <Badge className="bg-green-500 text-white flex items-center gap-1">
              <CheckCircle size={12} />
              DogeOS Devnet
            </Badge>
          ) : (
            <Button 
              onClick={handleNetworkSwitch}
              className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 text-sm px-3 py-1 h-auto"
            >
              <AlertTriangle size={12} />
              Switch to DogeOS
            </Button>
          )}
        </div>
      )}

      {/* User Stats (if connected and authenticated) */}
      {isConnected && user && isCorrectNetwork && (
        <div className="flex items-center gap-2">
          {isNFTHolder && (
            <Badge className="vip-badge">
              VIP Scientist 👨‍🔬
            </Badge>
          )}
          <div className="glass-panel p-2 text-sm">
            <div className="text-xs text-gray-600">Level {currentLevel}</div>
            <div className="font-bold">{points} Points</div>
          </div>
        </div>
      )}

      {/* BETA Badge */}
      <Badge className="bg-blue-600 text-white flex items-center gap-1">
        <Wifi size={12} />
        BETA
      </Badge>

      {/* Rainbow Kit Connect Button */}
      <ConnectButton 
        showBalance={false}
        chainStatus="icon"
        accountStatus={{
          smallScreen: 'avatar',
          largeScreen: 'full',
        }}
      />
    </div>
  );
};

export default WalletConnection;