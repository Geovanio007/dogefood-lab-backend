import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ArrowLeft, Calendar, Trophy, Target, Sparkles, Star, Crown } from 'lucide-react';
import { useGame } from '../contexts/GameContext';

const MyTreats = () => {
  const { isConnected, address } = useAccount();
  const { user, points, currentLevel, isNFTHolder } = useGame();
  const [selectedRarity, setSelectedRarity] = useState('all');
  const [treats, setTreats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch treats from backend API when component mounts or address changes
  useEffect(() => {
    const fetchTreats = async () => {
      if (!address && !isConnected) {
        setTreats([]);
        setLoading(false);
        return;
      }
      
      const playerAddress = address || 'demo_player';
      
      try {
        setLoading(true);
        console.log(`🔄 Fetching treats for ${playerAddress}...`);
        
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/treats/${playerAddress}`);
        
        if (response.ok) {
          const data = await response.json();
          const treatsArray = Array.isArray(data) ? data : data.treats || [];
          setTreats(treatsArray);
          console.log(`✅ Loaded ${treatsArray.length} treats from backend`);
        } else {
          console.log(`ℹ️ No treats found for ${playerAddress} (${response.status})`);
          setTreats([]);
        }
      } catch (err) {
        console.error('Error fetching treats:', err);
        setError('Failed to load treats');
        setTreats([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTreats();
  }, [address, isConnected]);
  
  const filteredTreats = treats.filter(treat => 
    selectedRarity === 'all' || treat.rarity?.toLowerCase() === selectedRarity.toLowerCase()
  );

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'Legendary': return 'bg-gradient-to-r from-purple-500 to-pink-500';
      case 'Epic': return 'bg-gradient-to-r from-pink-500 to-red-500';
      case 'Rare': return 'bg-gradient-to-r from-blue-500 to-indigo-500';
      default: return 'bg-gradient-to-r from-green-500 to-emerald-500';
    }
  };

  const getRarityIcon = (rarity) => {
    switch (rarity) {
      case 'Legendary': return '💎';
      case 'Epic': return '⭐';
      case 'Rare': return '✨';
      default: return '🍪';
    }
  };

  const rarities = ['all', 'legendary', 'epic', 'rare', 'common'];

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Menu
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-bold doge-gradient mb-2">🎨 My Treats</h1>
            <p className="text-gray-600">Your collection of magical Dogetreats</p>
          </div>
        </div>
        
        {isNFTHolder && (
          <Badge className="vip-badge">
            <Crown className="w-4 h-4 mr-1" />
            VIP Scientist
          </Badge>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="glass-panel">
          <CardContent className="text-center p-6">
            <div className="text-3xl font-bold doge-gradient">{treats.length}</div>
            <div className="text-sm text-gray-600">Total Treats Created</div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel">
          <CardContent className="text-center p-6">
            <div className="text-3xl font-bold text-purple-600">{isNFTHolder ? '1+' : '0'}</div>
            <div className="text-sm text-gray-600">DogeFood NFTs</div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel">
          <CardContent className="text-center p-6">
            <div className="text-3xl font-bold text-green-600">{points}</div>
            <div className="text-sm text-gray-600 mb-3">Total Points</div>
            <Button 
              disabled 
              size="sm" 
              className="bg-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300 text-xs"
              title="Points conversion available at season end"
            >
              Convert to $LAB
            </Button>
            <p className="text-xs text-gray-400 mt-1">Season End Only</p>
          </CardContent>
        </Card>
        
        <Card className="glass-panel">
          <CardContent className="text-center p-6">
            <div className="text-3xl font-bold text-yellow-600">0.00</div>
            <div className="text-sm text-gray-600">$LAB Tokens</div>
          </CardContent>
        </Card>
      </div>

      {/* Web3 Status */}
      {isConnected && address && (
        <Card className="glass-panel mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔗 Web3 Profile
              <Badge className="bg-green-500 text-white">Connected</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Wallet Address:</p>
                <p className="font-mono text-sm break-all">{address}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">NFT Holder Status:</p>
                <Badge className={isNFTHolder ? "bg-purple-500 text-white" : "bg-gray-500 text-white"}>
                  {isNFTHolder ? "VIP Scientist 👨‍🔬" : "Regular User"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Controls */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div className="flex gap-2">
          <span className="text-sm font-semibold text-gray-600 my-auto">Filter by Rarity:</span>
          {rarities.map(rarity => (
            <Button
              key={rarity}
              variant={selectedRarity === rarity ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedRarity(rarity)}
            >
              {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Treats Collection */}
      {loading ? (
        <Card className="glass-panel">
          <CardContent className="text-center p-12">
            <div className="text-6xl mb-4">🔄</div>
            <h3 className="text-2xl font-bold text-gray-600 mb-2">Loading your treats...</h3>
            <p className="text-gray-500">Fetching your magical creations from the lab!</p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="glass-panel">
          <CardContent className="text-center p-12">
            <div className="text-6xl mb-4">❌</div>
            <h3 className="text-2xl font-bold text-red-600 mb-2">Error loading treats</h3>
            <p className="text-gray-500 mb-6">{error}</p>
            <Button onClick={() => window.location.reload()} className="doge-button">
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : filteredTreats.length === 0 ? (
        <Card className="glass-panel">
          <CardContent className="text-center p-12">
            <div className="text-6xl mb-4">🥺</div>
            <h3 className="text-2xl font-bold text-gray-600 mb-2">
              {treats.length === 0 ? "No treats yet!" : "No treats match your filter"}
            </h3>
            <p className="text-gray-500 mb-6">
              {treats.length === 0 
                ? "Head to the Lab and start creating some magical Dogetreats!" 
                : "Try adjusting your filters to see more treats."}
            </p>
            {treats.length === 0 && (
              <Link to="/lab">
                <Button className="doge-button">
                  Start Creating Treats 🧪
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTreats.map((treat, index) => (
            <Card key={treat.id || index} className="glass-panel hover:scale-105 transition-all duration-300">
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <div className="text-4xl">{treat.image || getRarityIcon(treat.rarity)}</div>
                  <Badge className={`${getRarityColor(treat.rarity)} text-white`}>
                    {treat.rarity}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{treat.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Flavor Profile:</p>
                    <p className="text-sm">{treat.flavor}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Ingredients Used:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {treat.ingredients && treat.ingredients.map((ingredientId, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          Ingredient #{ingredientId}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {treat.createdAt ? new Date(treat.createdAt).toLocaleDateString() : 'Unknown'}
                    </div>
                    {treat.level && (
                      <div>Lab Level {treat.level}</div>
                    )}
                  </div>
                  
                  {/* Season 1: Mint Button (Coming Soon) */}
                  <div className="pt-3 border-t border-gray-200">
                    <Button 
                      disabled 
                      className="w-full bg-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300"
                      title="Minting will be available in future seasons"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Mint NFT - Coming Soon!
                    </Button>
                    <p className="text-xs text-gray-400 text-center mt-1">
                      Available in Season 2
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Call to Action */}
      {filteredTreats.length > 0 && (
        <div className="mt-12 text-center">
          <Card className="glass-panel max-w-md mx-auto">
            <CardContent className="p-8">
              <h3 className="text-xl font-bold mb-4">Keep Creating! 🚀</h3>
              <p className="text-gray-600 mb-4">
                Create more treats to unlock rare recipes and earn more $LAB tokens!
              </p>
              <Link to="/lab">
                <Button className="doge-button w-full">
                  Back to Lab 🧪
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MyTreats;