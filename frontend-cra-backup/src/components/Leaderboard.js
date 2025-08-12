import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useGame } from '../contexts/GameContext';
import { ArrowLeft, Trophy, Crown, Medal, Star, Zap } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Leaderboard = () => {
  const { isNFTHolder, points, currentLevel } = useGame();
  const [leaderboard, setLeaderboard] = useState([]);
  const [gameStats, setGameStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
    fetchGameStats();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await axios.get(`${API}/leaderboard`);
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      // Mock data for demonstration
      setLeaderboard([
        { address: '0x1234...7890', points: 2850, level: 8, rank: 1, is_nft_holder: true },
        { address: '0xabcd...efgh', points: 2340, level: 7, rank: 2, is_nft_holder: true },
        { address: '0x5678...ijkl', points: 1890, level: 6, rank: 3, is_nft_holder: true },
        { address: '0x9876...mnop', points: 1650, level: 5, rank: 4, is_nft_holder: true },
        { address: '0x4567...qrst', points: 1420, level: 5, rank: 5, is_nft_holder: true },
      ]);
    }
    setLoading(false);
  };

  const fetchGameStats = async () => {
    try {
      const response = await axios.get(`${API}/stats`);
      setGameStats(response.data);
    } catch (error) {
      console.error('Error fetching game stats:', error);
      // Mock data for demonstration
      setGameStats({
        total_players: 1247,
        nft_holders: 89,
        total_treats: 3420,
        active_today: 156
      });
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2: return <Medal className="w-6 h-6 text-gray-400" />;
      case 3: return <Medal className="w-6 h-6 text-orange-600" />;
      default: return <Trophy className="w-6 h-6 text-gray-400" />;
    }
  };

  const getRankColor = (rank) => {
    switch (rank) {
      case 1: return 'bg-gradient-to-r from-yellow-400 to-orange-500';
      case 2: return 'bg-gradient-to-r from-gray-300 to-gray-500';
      case 3: return 'bg-gradient-to-r from-orange-400 to-red-500';
      default: return 'bg-gradient-to-r from-blue-400 to-purple-500';
    }
  };

  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
          <h1 className="text-4xl font-bold doge-gradient">Leaderboard 🏆</h1>
        </div>
        
        <div className="flex items-center gap-4">
          {isNFTHolder && (
            <Badge className="vip-badge">VIP Scientist</Badge>
          )}
          <div className="glass-panel p-3">
            <div className="text-sm text-gray-600">Your Points</div>
            <div className="font-bold text-xl text-yellow-600">{points}</div>
          </div>
        </div>
      </div>

      {/* Game Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <Card className="glass-panel">
          <CardContent className="p-6 text-center">
            <Star className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <div className="font-bold text-2xl text-blue-600">{gameStats.total_players || 0}</div>
            <div className="text-sm text-gray-600">Total Players</div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel">
          <CardContent className="p-6 text-center">
            <Crown className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
            <div className="font-bold text-2xl text-yellow-600">{gameStats.nft_holders || 0}</div>
            <div className="text-sm text-gray-600">VIP Scientists</div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel">
          <CardContent className="p-6 text-center">
            <Zap className="w-8 h-8 mx-auto mb-2 text-purple-600" />
            <div className="font-bold text-2xl text-purple-600">{gameStats.total_treats || 0}</div>
            <div className="text-sm text-gray-600">Treats Created</div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel">
          <CardContent className="p-6 text-center">
            <Trophy className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <div className="font-bold text-2xl text-green-600">{gameStats.active_today || 0}</div>
            <div className="text-sm text-gray-600">Active Today</div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-600" />
            Top VIP Scientists
          </CardTitle>
          <div className="text-sm text-gray-600">
            Only DogeFood NFT holders earn points and compete for $LAB airdrops! 🪂
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full mx-auto"></div>
              <div className="text-gray-600 mt-2">Loading leaderboard...</div>
            </div>
          ) : leaderboard.length > 0 ? (
            <div className="space-y-4">
              {leaderboard.map((player) => (
                <div
                  key={player.address}
                  className={`leaderboard-entry p-4 rounded-xl transition-all ${
                    player.rank <= 3 ? 'bg-white/30' : 'bg-white/20'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getRankColor(player.rank)}`}>
                      {player.rank <= 3 ? getRankIcon(player.rank) : (
                        <span className="font-bold text-white">#{player.rank}</span>
                      )}
                    </div>
                    
                    {/* Avatar */}
                    <Avatar className="w-12 h-12">
                      <AvatarImage src="https://images.unsplash.com/photo-1456081445129-830eb8d4bfc6?w=50&h=50&fit=crop&crop=face" />
                      <AvatarFallback>🐕</AvatarFallback>
                    </Avatar>
                    
                    {/* Player Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{formatAddress(player.address)}</span>
                        {player.is_nft_holder && (
                          <Badge className="vip-badge text-xs">VIP</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">Level {player.level} Scientist</div>
                    </div>
                    
                    {/* Points */}
                    <div className="text-right">
                      <div className="font-bold text-xl text-yellow-600">{player.points.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">points</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-bold text-gray-600 mb-2">No Rankings Yet!</h3>
              <p className="text-gray-500 mb-6">
                Be the first VIP Scientist to start earning points and climb the leaderboard!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* $LAB Token Info */}
      <Card className="glass-panel mt-8">
        <CardHeader>
          <CardTitle className="text-center doge-gradient">$LAB Token Airdrop 🪂</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">💰</div>
            <p className="text-lg text-gray-700 mb-4">
              Top VIP Scientists will receive $LAB tokens based on their leaderboard ranking!
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-xl">
              <Crown className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
              <h4 className="font-bold text-lg">🥇 1st Place</h4>
              <p className="text-sm text-gray-600">10,000 $LAB</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl">
              <Medal className="w-8 h-8 mx-auto mb-2 text-gray-600" />
              <h4 className="font-bold text-lg">🥈 2nd Place</h4>
              <p className="text-sm text-gray-600">5,000 $LAB</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-orange-100 to-red-100 rounded-xl">
              <Medal className="w-8 h-8 mx-auto mb-2 text-orange-600" />
              <h4 className="font-bold text-lg">🥉 3rd Place</h4>
              <p className="text-sm text-gray-600">2,500 $LAB</p>
            </div>
          </div>
          
          <div className="text-center mt-6">
            <p className="text-sm text-gray-600">
              Plus: Top 50 players receive bonus $LAB tokens! 🎉
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Call to Action */}
      {!isNFTHolder && (
        <Card className="glass-panel mt-8 border-2 border-yellow-400">
          <CardContent className="text-center p-8">
            <h3 className="text-2xl font-bold doge-gradient mb-4">Want to Compete? 🚀</h3>
            <p className="text-gray-700 mb-6">
              Only DogeFood NFT holders can earn points and compete for $LAB airdrops!
            </p>
            <Button className="doge-button">
              Get DogeFood NFT 🐕
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Leaderboard;