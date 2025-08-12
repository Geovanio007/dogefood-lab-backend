import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useGame } from '../contexts/GameContext';
import { useWeb3 } from '../hooks/useWeb3';
import { useWeb3Game } from '../hooks/useWeb3Game';
import WalletConnection from './WalletConnection';
import { Beaker, Trophy, Settings, Palette, ExternalLink } from 'lucide-react';

const MainMenu = () => {
  const { user, isNFTHolder, currentLevel, points, createdTreats, dispatch } = useGame();
  const { address, isConnected, isCorrectNetwork } = useWeb3();
  const { web3Profile, loading: web3Loading, getContractInfo } = useWeb3Game();
  const [contractInfo, setContractInfo] = useState(null);

  // Fetch contract information on mount
  useEffect(() => {
    const fetchContractInfo = async () => {
      const info = await getContractInfo();
      setContractInfo(info);
    };
    fetchContractInfo();
  }, [getContractInfo]);

  // Auto-set user when wallet connects and is on correct network
  useEffect(() => {
    if (isConnected && isCorrectNetwork && address && !user) {
      dispatch({ type: 'SET_USER', payload: { address: address.toLowerCase() } });
    }
  }, [isConnected, isCorrectNetwork, address, user, dispatch]);

  // Clear user when wallet disconnects
  useEffect(() => {
    if (!isConnected && user) {
      dispatch({ type: 'SET_USER', payload: null });
    }
  }, [isConnected, user, dispatch]);

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
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <h1 className="text-6xl font-bold">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-800 via-yellow-600 to-orange-600 drop-shadow-lg">
                  DogeFood Lab
                </span>
                <span className="ml-3 text-5xl">🧪</span>
              </h1>
              <Badge className="bg-blue-500 text-white text-sm px-3 py-1">
                BETA
              </Badge>
            </div>
            <p className="text-xl text-gray-800 font-semibold drop-shadow-md">
              Mix, Test & Upgrade Your Way to the Top! 🚀
            </p>
          </div>
          <div className="flex items-center gap-4">
            <WalletConnection />
          </div>
        </div>

        {/* Main Menu Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          
          {/* Enter Lab */}
          <Card className="glass-panel hover:scale-105 transition-all duration-300 cursor-pointer">
            <Link to="/lab">
              <CardHeader className="text-center">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-4">
                  <Beaker size={40} className="text-white" />
                </div>
                <CardTitle className="text-2xl doge-gradient">Enter Lab</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 mb-4">
                  Start mixing magical Dogetreats and unlock new recipes!
                </p>
                <Button className="doge-button w-full">
                  Start Mixing 🧪
                </Button>
              </CardContent>
            </Link>
          </Card>

          {/* My NFTs */}
          <Card className="glass-panel hover:scale-105 transition-all duration-300 cursor-pointer">
            <Link to="/nfts">
              <CardHeader className="text-center">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center mb-4">
                  <Palette size={40} className="text-white" />
                </div>
                <CardTitle className="text-2xl doge-gradient">My Treats</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 mb-4">
                  View your created Dogetreats and rare collections!
                </p>
                <Button className="doge-button w-full">
                  View Collection 🎨
                </Button>
              </CardContent>
            </Link>
          </Card>

          {/* Leaderboard */}
          <Card className="glass-panel hover:scale-105 transition-all duration-300 cursor-pointer">
            <Link to="/leaderboard">
              <CardHeader className="text-center">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center mb-4">
                  <Trophy size={40} className="text-white" />
                </div>
                <CardTitle className="text-2xl doge-gradient">Leaderboard</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 mb-4">
                  Compete with other VIP Scientists for $LAB rewards!
                </p>
                <Button className="doge-button w-full">
                  View Rankings 🏆
                </Button>
              </CardContent>
            </Link>
          </Card>
        </div>

        {/* Web3 Status Dashboard (for connected users) */}
        {isConnected && isCorrectNetwork && web3Profile && (
          <Card className="glass-panel border-green-400">
            <CardHeader>
              <CardTitle className="text-center text-green-800 flex items-center justify-center gap-2">
                🔗 Web3 Profile Connected
                <Badge className="bg-green-600 text-white">Live on DogeOS</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-xl">
                  <h4 className="font-bold text-green-800 mb-2">💰 LAB Balance</h4>
                  <p className="text-2xl font-bold text-green-700">
                    {parseFloat(web3Profile.labBalance).toLocaleString()} LAB
                  </p>
                  {contractInfo?.labToken && (
                    <a 
                      href={`https://blockscout.devnet.doge.xyz/address/${contractInfo.labToken.address}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-green-600 hover:underline flex items-center justify-center gap-1 mt-1"
                    >
                      View Contract <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                
                <div className="text-center p-4 bg-purple-50 rounded-xl">
                  <h4 className="font-bold text-purple-800 mb-2">🎨 DogeFood NFTs</h4>
                  <p className="text-2xl font-bold text-purple-700">
                    {web3Profile.nftBalance} / 420
                  </p>
                  <p className="text-sm text-purple-600">
                    {web3Profile.isNftHolder ? '✅ VIP Scientist' : '❌ Not a holder'}
                  </p>
                  {contractInfo?.nftCollection && (
                    <a 
                      href={`https://blockscout.devnet.doge.xyz/address/${contractInfo.nftCollection.address}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-purple-600 hover:underline flex items-center justify-center gap-1 mt-1"
                    >
                      View NFT Contract <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <h4 className="font-bold text-blue-800 mb-2">🏆 Season Status</h4>
                  <p className="text-2xl font-bold text-blue-700">
                    Season {web3Profile.currentSeason || 'TBD'}
                  </p>
                  <p className="text-sm text-blue-600">
                    {web3Profile.isNftHolder ? 'Eligible for rewards' : 'NFT required'}
                  </p>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-center">
                <a 
                  href={web3Profile.explorerUrl}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 hover:text-gray-800 flex items-center justify-center gap-1"
                >
                  View wallet on DogeOS Explorer <ExternalLink size={12} />
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading Web3 Data */}
        {isConnected && isCorrectNetwork && web3Loading && (
          <Card className="glass-panel border-blue-400">
            <CardContent className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-blue-700">Loading Web3 profile from DogeOS blockchain...</p>
            </CardContent>
          </Card>
        )}

        {/* Doge Scientist Avatar */}
        <div className="text-center mb-8">
          <div className="inline-block">
            <img 
              src="https://i.ibb.co/hJQcdpfM/1000025492-removebg-preview.png"
              alt="Doge Scientist"
              className="w-40 h-40 rounded-full border-6 border-yellow-400 shadow-2xl hover:scale-110 transition-transform duration-300 bg-white/20 backdrop-blur-sm"
            />
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mt-4">
            Welcome to DogeFood Lab! 🐕‍🦺
          </h3>
        </div>

        {/* Powered By Banner Section */}
        <div className="text-center mb-12">
          <h4 className="text-lg font-semibold text-gray-700 mb-6">
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
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-center doge-gradient text-2xl">
                Connect Your Wallet to Get Started! 🔗
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="text-center p-4 bg-white/20 rounded-xl">
                  <h4 className="font-bold text-lg mb-2">For Everyone 🎮</h4>
                  <ul className="text-sm space-y-1">
                    <li>• Play for fun & advance levels</li>
                    <li>• Mix unlimited Dogetreats</li>
                    <li>• Unlock new ingredients</li>
                    <li>• Enjoy the full experience!</li>
                  </ul>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-xl">
                  <h4 className="font-bold text-lg mb-2">For NFT Holders ⭐</h4>
                  <ul className="text-sm space-y-1">
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
          <p className="text-gray-500 text-sm">
            Built with ❤️ for the Dogecoin community • Much wow, such science! 🌙
          </p>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;