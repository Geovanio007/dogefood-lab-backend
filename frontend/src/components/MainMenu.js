import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useGame } from '../contexts/GameContext';
import { useNFTVerification } from '../hooks/useNFTVerification';
import ThemeToggle from './ThemeToggle';
import DogeFoodLogo from './DogeFoodLogo';
import { Beaker, Trophy, Settings, Palette } from 'lucide-react';

const MainMenu = () => {
  const { address, isConnected } = useAccount();
  const { nftBalance, isNFTHolder, loading: nftLoading } = useNFTVerification();
  const { user, currentLevel, points, dispatch, loadPlayerData } = useGame();

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
  }, [isConnected, address, isNFTHolder, nftBalance, nftLoading, dispatch, loadPlayerData]);

  return (
    <div className="lab-container min-h-screen p-8">
      {/* Background Lab Scene */}
      <div className="absolute inset-0 opacity-10">
        <img
          src="https://images.unsplash.com/photo-1578272018819-412aef6cb45d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHxsYWJvcmF0b3J5JTIwZXF1aXBtZW50JTIwY29sb3JmdWx8ZW58MHx8fHwxNzU0OTQ2OTAwfDA&ixlib=rb-4.1.0&q=85"
          alt="Lab Background"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        
        {/* Shiba Pouring Cereal - Right Side Prominent */}
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-30">
          <div className="relative">
            <img
              src="/shiba-pouring-cereal.png"
              alt="Shiba Inu Pouring Cereal"
              className="w-96 h-auto object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-300"
              style={{
                filter: 'drop-shadow(0 15px 35px rgba(0,0,0,0.4)) brightness(1.1) contrast(1.1)'
              }}
            />
            {/* Fun floating animation */}
            <div className="absolute -top-4 -right-4 animate-bounce">
              <span className="text-3xl">🥣</span>
            </div>
          </div>
        </div>
        {/* Header with New Logo */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <DogeFoodLogo 
              size="hero" 
              showText={false} 
              showBeta={true}
              className="animate-fade-in mb-4"
            />
            <p className="text-2xl text-yellow-500 font-bold playful-text bubble-text drop-shadow-lg">
              Mix, Test & Upgrade Your Way to the Top! 🚀
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Toggle Button */}
            <ThemeToggle />
            
            {isConnected && (
              <div className="flex items-center gap-2">
                {isNFTHolder && (
                  <Badge className="vip-badge">
                    VIP Scientist 👨‍🔬
                  </Badge>
                )}
                <div className="glass-panel p-3">
                  <div className="text-sm text-gray-600">Level {currentLevel}</div>
                  <div className="font-bold text-lg">{points} Points</div>
                </div>
              </div>
            )}
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
                              className="doge-button"
                            >
                              Connect Wallet
                            </Button>
                          );
                        }

                        if (chain.unsupported) {
                          return (
                            <Button
                              onClick={openChainModal}
                              className="bg-red-500 text-white px-4 py-2 rounded-lg"
                            >
                              Wrong network
                            </Button>
                          );
                        }

                        return (
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={openAccountModal}
                              className="doge-button"
                            >
                              {`${account.address.slice(0,6)}...${account.address.slice(-4)}`}
                            </Button>
                          </div>
                        );
                      })()}
                    </div>
                  );
                }}
              </ConnectButton.Custom>
            </div>
          </div>
        </div>

        {/* Season 1 Announcement Banner */}
        <div className="mb-8">
          <Card className="glass-panel border-4 border-orange-400 bg-gradient-to-r from-orange-100/90 to-yellow-100/90">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">🎮</div>
                  <div>
                    <h3 className="text-2xl font-bold text-orange-800 mb-2">
                      🚀 Season 1: Offchain Launch
                    </h3>
                    <p className="text-orange-700 text-lg">
                      Welcome to the beta! Create treats, earn points, and climb the leaderboard. 
                      <strong className="text-orange-900"> NFT minting and token conversion coming in Season 2!</strong>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className="bg-orange-500 text-white px-4 py-2 text-lg mb-2">
                    Season 1
                  </Badge>
                  <div className="text-sm text-orange-600">
                    <div>✅ Treat Creation</div>
                    <div>✅ Points & Leaderboards</div>
                    <div>🔜 NFT Minting (Season 2)</div>
                    <div>🔜 Token Conversion (Season 2)</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Menu Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Enter Lab */}
          <Card className="game-card hover:scale-105 transition-all duration-300 cursor-pointer">
            <Link to="/lab">
              <CardHeader className="text-center">
                <div className="mx-auto w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-4 shadow-xl">
                  <Beaker size={48} className="text-white drop-shadow-lg" />
                </div>
                <CardTitle className="text-3xl playful-title bubble-text text-white">🧪 Enter Lab</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-white/90 mb-6 playful-text text-lg bubble-text">
                  Start mixing magical Dogetreats and unlock new recipes!
                </p>
                <Button className="doge-button w-full text-lg">
                  Start Mixing 🧪
                </Button>
              </CardContent>
            </Link>
          </Card>

          {/* Active Treats Dashboard */}
          <Card className="game-card hover:scale-105 transition-all duration-300 cursor-pointer">
            <Link to="/dashboard">
              <CardHeader className="text-center">
                <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full flex items-center justify-center mb-4 shadow-xl">
                  <Clock size={48} className="text-white drop-shadow-lg" />
                </div>
                <CardTitle className="text-3xl playful-title bubble-text text-white">⏰ Active Treats</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-white/90 mb-6 playful-text text-lg bubble-text">
                  Check your brewing treats and collect ready ones!
                </p>
                <Button className="doge-button w-full text-lg">
                  View Dashboard ⏰
                </Button>
              </CardContent>
            </Link>
          </Card>

          {/* My NFTs */}
          <Card className="game-card hover:scale-105 transition-all duration-300 cursor-pointer">
            <Link to="/nfts">
              <CardHeader className="text-center">
                <div className="mx-auto w-24 h-24 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center mb-4 shadow-xl">
                  <Palette size={48} className="text-white drop-shadow-lg" />
                </div>
                <CardTitle className="text-3xl playful-title bubble-text text-white">🎨 My Treats</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-white/90 mb-6 playful-text text-lg bubble-text">
                  View your created Dogetreats and rare collections!
                </p>
                <Button className="doge-button w-full text-lg">
                  View Collection 🎨
                </Button>
              </CardContent>
            </Link>
          </Card>

          {/* Leaderboard */}
          <Card className="game-card hover:scale-105 transition-all duration-300 cursor-pointer">
            <Link to="/leaderboard">
              <CardHeader className="text-center">
                <div className="mx-auto w-24 h-24 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center mb-4 shadow-xl">
                  <Trophy size={48} className="text-white drop-shadow-lg" />
                </div>
                <CardTitle className="text-3xl playful-title bubble-text text-white">🏆 Leaderboard</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-white/90 mb-6 playful-text text-lg bubble-text">
                  Compete with other VIP Scientists for $LAB rewards!
                </p>
                <Button className="doge-button w-full text-lg">
                  View Rankings 🏆
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
            Welcome to DogeFood Lab! 🐕‍🦺
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