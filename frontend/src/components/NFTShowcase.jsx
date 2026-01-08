import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useGame } from '../contexts/GameContext';
import { ArrowLeft, Package, Star, Sparkles, Gift, Zap } from 'lucide-react';
import TreatIcon from './TreatIcon';

const NFTShowcase = () => {
  const { createdTreats, isNFTHolder, currentLevel, points } = useGame();

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'Legendary': return 'from-purple-500 to-pink-500';
      case 'Epic': return 'from-blue-500 to-purple-500';
      case 'Rare': return 'from-green-500 to-blue-500';
      default: return 'from-yellow-500 to-orange-500';
    }
  };

  const getRarityIcon = (rarity) => {
    switch (rarity) {
      case 'Legendary': return <Sparkles className="w-4 h-4" />;
      case 'Epic': return <Star className="w-4 h-4" />;
      case 'Rare': return <Zap className="w-4 h-4" />;
      default: return <Gift className="w-4 h-4" />;
    }
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
          <h1 className="text-4xl font-bold doge-gradient flex items-center gap-2">My Dogetreats <TreatIcon size="xl" /></h1>
        </div>
        
        <div className="flex items-center gap-4">
          {isNFTHolder && (
            <Badge className="vip-badge">VIP Scientist</Badge>
          )}
          <div className="glass-panel p-3">
            <div className="text-sm text-gray-600">Total Created</div>
            <div className="font-bold text-xl text-purple-600">{createdTreats.length}</div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="glass-panel">
          <CardContent className="p-6 text-center">
            <Package className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
            <div className="font-bold text-2xl text-yellow-600">{createdTreats.length}</div>
            <div className="text-sm text-gray-600">Total Treats</div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel">
          <CardContent className="p-6 text-center">
            <Star className="w-8 h-8 mx-auto mb-2 text-purple-600" />
            <div className="font-bold text-2xl text-purple-600">
              {createdTreats.filter(t => t.rarity === 'Legendary').length}
            </div>
            <div className="text-sm text-gray-600">Legendary</div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel">
          <CardContent className="p-6 text-center">
            <Zap className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <div className="font-bold text-2xl text-blue-600">
              {createdTreats.filter(t => t.rarity === 'Epic' || t.rarity === 'Rare').length}
            </div>
            <div className="text-sm text-gray-600">Epic & Rare</div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel">
          <CardContent className="p-6 text-center">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <div className="font-bold text-2xl text-green-600">{points}</div>
            <div className="text-sm text-gray-600">Total Points</div>
          </CardContent>
        </Card>
      </div>

      {/* NFT Collection */}
      {createdTreats.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {createdTreats.map((treat) => (
            <Card key={treat.id} className="nft-card glass-panel overflow-hidden">
              <div className={`h-2 bg-gradient-to-r ${getRarityColor(treat.rarity)}`} />
              
              <CardHeader className="text-center p-6">
                <div className="text-6xl mb-4">{treat.image}</div>
                <CardTitle className="text-lg font-bold">{treat.name}</CardTitle>
                <div className="flex justify-center">
                  <Badge className={`bg-gradient-to-r ${getRarityColor(treat.rarity)} text-white`}>
                    {getRarityIcon(treat.rarity)}
                    <span className="ml-1">{treat.rarity}</span>
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="px-6 pb-6">
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-700 mb-1">Flavor Profile:</div>
                  <div className="text-xs text-gray-600 bg-white/30 p-2 rounded">{treat.flavor}</div>
                </div>
                
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-700 mb-1">Ingredients:</div>
                  <div className="text-xs text-gray-600">{treat.ingredients.length} unique ingredients</div>
                </div>
                
                <div className="text-xs text-gray-500">
                  Created: {new Date(treat.createdAt).toLocaleDateString()}
                </div>
                
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" className="flex-1 text-xs">
                    Share 🔗
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-xs">
                    Gift 🎁
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="glass-panel">
          <CardContent className="text-center py-16">
            <Package className="w-24 h-24 mx-auto mb-6 text-gray-400" />
            <h3 className="text-2xl font-bold text-gray-600 mb-4">No Treats Created Yet!</h3>
            <p className="text-gray-500 mb-6">
              Head to the lab and start mixing ingredients to create your first Dogetreat.
            </p>
            <Link to="/lab">
              <Button className="doge-button">
                Start Mixing 🧪
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Future Features Teaser */}
      <Card className="glass-panel mt-8">
        <CardHeader>
          <CardTitle className="text-center doge-gradient">Coming Soon! 🚀</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="p-4 bg-white/20 rounded-xl">
              <div className="text-3xl mb-2">🏪</div>
              <h4 className="font-bold mb-1">NFT Marketplace</h4>
              <p className="text-sm text-gray-600">Trade your rare Dogetreats with other players!</p>
            </div>
            <div className="p-4 bg-white/20 rounded-xl">
              <div className="text-3xl mb-2">⚗️</div>
              <h4 className="font-bold mb-1">Fusion Chamber</h4>
              <p className="text-sm text-gray-600">Combine treats to create ultra-rare Mega Meals!</p>
            </div>
            <div className="p-4 bg-white/20 rounded-xl">
              <div className="text-3xl mb-2"><TreatIcon size="xl" /></div>
              <h4 className="font-bold mb-1">Custom Skins</h4>
              <p className="text-sm text-gray-600">Personalize your Shiba Inu scientist avatar!</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NFTShowcase;