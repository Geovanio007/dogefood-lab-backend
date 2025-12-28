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
import { Beaker, Trophy, Settings, Palette, Clock } from 'lucide-react';

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
  }, [isConnected, address, isNFTHolder, nftBalance, nftLoading, dispatch]);

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
        
        {/* Shiba Inu image removed as requested */}
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

        {/* Season 1 Announcement Banner - Modern Vibrant Design */}
        <div className="mb-8">
          <Card className="overflow-hidden border-0 shadow-2xl">
            {/* Gradient Background */}
            <div className="relative bg-gradient-to-r from-sky-400 via-emerald-400 to-yellow-400 p-1">
              <CardContent className="relative bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 dark:from-slate-900/98 dark:via-slate-800/98 dark:to-slate-900/98 rounded-lg p-6 backdrop-blur-sm">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400/20 to-transparent rounded-full blur-2xl"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-sky-400/20 to-transparent rounded-full blur-2xl"></div>
                
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                  {/* Left Content */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className="relative">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-yellow-400 via-emerald-400 to-sky-400 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                        <span className="text-3xl md:text-4xl">🧪</span>
                      </div>
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md">
                        1
                      </div>
                    </div>
                    <div>
                      <h3 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-yellow-400 via-emerald-400 to-sky-400 bg-clip-text text-transparent mb-1">
                        Season 1: Beta Launch
                      </h3>
                      <p className="text-white/90 dark:text-white/90 text-sm md:text-base max-w-md">
                        Create treats, earn points, and climb the leaderboard!
                        <span className="block mt-1 text-emerald-400 font-semibold">
                          NFT minting & token conversion coming in Season 2!
                        </span>
                      </p>
                    </div>
                  </div>
                  
                  {/* Right Content - Status Pills */}
                  <div className="flex flex-col gap-2">
                    <Badge className="bg-gradient-to-r from-sky-500 to-sky-600 text-white px-4 py-2 text-sm font-bold shadow-lg border-0">
                      🎮 SEASON 1 ACTIVE
                    </Badge>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                        Treat Creation
                      </div>
                      <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                        Leaderboards
                      </div>
                      <div className="flex items-center gap-1 bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                        <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                        NFT Minting
                      </div>
                      <div className="flex items-center gap-1 bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                        <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                        Token Convert
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </div>
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