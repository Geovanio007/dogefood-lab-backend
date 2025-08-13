import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useGame } from '../contexts/GameContext';
import { ArrowLeft, Beaker, Sparkles, Clock, Star, Crown, Shuffle } from 'lucide-react';

const EnhancedGameLab = () => {
  const { isConnected, address } = useAccount();
  const {
    // Use the working GameContext structure
    user,
    isNFTHolder,
    currentLevel,
    experience,
    points,
    ingredients,
    mixing,
    startMixing,
    completeMixing,
    dispatch,
    gameConfig
  } = useGame();

  const [selectedIngredients, setSelectedIngredients] = useState([]);

  // Handle ingredient selection (compatible with old system)
  const handleIngredientClick = (ingredient) => {
    if (selectedIngredients.includes(ingredient.id)) {
      // Deselect
      setSelectedIngredients(prev => prev.filter(id => id !== ingredient.id));
    } else if (selectedIngredients.length < 3) {
      // Select (max 3)
      setSelectedIngredients(prev => [...prev, ingredient.id]);
    }
  };

  // Handle treat creation (using the working system)
  const handleCreateTreat = () => {
    if (selectedIngredients.length >= 2) {
      startMixing(selectedIngredients);
      
      // Complete mixing after a short delay (using existing system)
      setTimeout(() => {
        completeMixing();
        setSelectedIngredients([]);
      }, 2000);
    }
  };

  // Show wallet connection requirement if no user
  if (!isConnected || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <Link to="/" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors">
              <ArrowLeft size={20} />
              <span className="font-bold">Back to Menu</span>
            </Link>
            <h1 className="text-4xl font-bold playful-title text-blue-800">
              🧪 DogeFood Lab
            </h1>
          </div>

          {/* Connect Wallet Prompt */}
          <Card className="game-card max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="playful-title text-white text-3xl mb-4">
                🔗 Connect Your Wallet to Start Creating!
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <p className="text-white/90 playful-text text-lg">
                Connect your wallet to save progress, earn points, and compete on leaderboards!
              </p>
              <div className="text-white/80 playful-text">
                <p>✨ Create amazing Dogetreats</p>
                <p>🏆 Compete with other scientists</p>
                <p>💎 Earn $LAB rewards</p>
                <p>📈 Level up your skills</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors">
              <ArrowLeft size={20} />
              <span className="font-bold">Back to Menu</span>
            </Link>
            <div>
              <h1 className="text-4xl font-bold playful-title text-blue-800">
                🧪 DogeFood Lab
              </h1>
              <p className="text-blue-600 font-medium playful-text">
                Welcome, Scientist! Level {currentLevel}
              </p>
            </div>
          </div>

          {/* Player Stats */}
          <div className="flex flex-wrap gap-4">
            <div className="stat-card">
              <div className="stat-label">Level</div>
              <div className="stat-value">{currentLevel}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">XP</div>
              <div className="stat-value">{experience}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Points</div>
              <div className="stat-value">{points}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Mixing Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Enhanced Ingredient Selection */}
            <Card className="game-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="playful-title text-white text-2xl">
                    🥄 Enhanced Ingredient Shelf
                  </CardTitle>
                  <Button 
                    onClick={() => setSelectedIngredients([])}
                    className="doge-button"
                    size="sm"
                  >
                    <Shuffle size={16} className="mr-2" />
                    Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-white/80 playful-text text-lg">
                  Select 2-3 ingredients to create amazing Dogetreats:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {ingredients.map((ingredient) => {
                    const isSelected = selectedIngredients.includes(ingredient.id);
                    return (
                      <div
                        key={ingredient.id}
                        onClick={() => handleIngredientClick(ingredient)}
                        className={`ingredient-card cursor-pointer transition-all duration-300 ${
                          isSelected ? 'selected ring-4 ring-yellow-400' : ''
                        } bg-gradient-to-br from-emerald-400/90 to-teal-500/90`}
                      >
                        <div className="text-4xl mb-2">{ingredient.image}</div>
                        <div className="font-bold text-white text-sm">{ingredient.name}</div>
                        <div className="text-xs text-white/80 capitalize">{ingredient.type}</div>
                        <div className="text-xs text-white/60">Tier {ingredient.tier}</div>
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <Star className="w-5 h-5 text-yellow-400 fill-current" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Mixing Station */}
            <Card className="game-card">
              <CardHeader>
                <CardTitle className="playful-title text-white text-2xl">
                  🧪 Advanced Mixing Station
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Selected Ingredients Display */}
                <div className="space-y-4">
                  <h4 className="font-bold text-white playful-text text-lg">Selected Ingredients:</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedIngredients.map((ingredientId) => {
                      const ingredient = ingredients.find(ing => ing.id === ingredientId);
                      return ingredient ? (
                        <Badge key={ingredientId} className="vip-badge text-lg px-4 py-2">
                          {ingredient.image} {ingredient.name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </div>

                {/* Enhanced Mixing Bowl Visual */}
                <div className="flex justify-center">
                  <div className="mixing-bowl relative">
                    {mixing.active && (
                      <div className="mixing-animation absolute inset-0 flex items-center justify-center">
                        <Sparkles className="w-12 h-12 text-yellow-400 animate-spin" />
                      </div>
                    )}
                    {selectedIngredients.length >= 2 && !mixing.active && (
                      <div className="sparkle-effect absolute inset-0 flex items-center justify-center">
                        <Beaker className="w-12 h-12 text-blue-400" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-6xl">🧪</div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    onClick={handleCreateTreat}
                    disabled={selectedIngredients.length < 2 || mixing.active}
                    className="doge-button text-lg px-8 py-4"
                  >
                    {mixing.active ? (
                      <>
                        <div className="spinner mr-2"></div>
                        Creating Amazing Treat...
                      </>
                    ) : (
                      <>
                        <Beaker className="mr-2" size={20} />
                        Create Enhanced Treat! ({selectedIngredients.length}/3)
                      </>
                    )}
                  </Button>
                </div>

                {/* Enhanced Instructions */}
                <div className="text-center text-white/80 playful-text">
                  <p className="text-lg mb-2">💡 <strong>Pro Tips:</strong></p>
                  <p>🌟 Mix different ingredient types for higher rarity!</p>
                  <p>⚡ Higher tier ingredients = more XP and better treats!</p>
                  <p>🏆 Compete with other scientists on the leaderboard!</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Sidebar */}
          <div className="space-y-6">
            {/* Level Progress */}
            <Card className="game-card">
              <CardHeader>
                <CardTitle className="playful-title text-white text-xl">
                  📈 Scientist Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-white">
                    <span>Level {currentLevel} Master Creator</span>
                    <span>{experience}/100 XP</span>
                  </div>
                  <div className="level-progress-bar">
                    <div 
                      className="level-progress-fill"
                      style={{ width: `${(experience % 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-white/80 text-sm text-center playful-text">
                  {100 - (experience % 100)} XP to next level
                </div>
                {isNFTHolder && (
                  <Badge className="vip-badge w-full justify-center">
                    👑 VIP Scientist Status
                  </Badge>
                )}
              </CardContent>
            </Card>

            {/* Enhanced Instructions */}
            <Card className="game-card">
              <CardHeader>
                <CardTitle className="playful-title text-white text-xl">
                  📋 Enhanced Lab Guide
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-white/90 playful-text space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">1️⃣</span>
                    <p><strong>Select 2-3 ingredients</strong> from the enhanced shelf</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-lg">2️⃣</span>
                    <p><strong>Mix different types</strong> for higher rarity treats</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-lg">3️⃣</span>
                    <p><strong>Earn XP and level up</strong> to unlock new ingredients</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-lg">4️⃣</span>
                    <p><strong>Compete on leaderboards</strong> for $LAB rewards</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-lg">5️⃣</span>
                    <p><strong>Become the ultimate</strong> VIP Scientist!</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* VIP Status Card */}
            {isNFTHolder && (
              <Card className="game-card">
                <CardHeader>
                  <CardTitle className="playful-title text-white text-xl">
                    👑 VIP Scientist Perks
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-white/90 playful-text text-sm space-y-2">
                    <p>✨ <strong>Bonus XP</strong> from all treats</p>
                    <p>🏆 <strong>Leaderboard eligible</strong> for $LAB rewards</p>
                    <p>🎯 <strong>Exclusive ingredients</strong> coming soon!</p>
                    <p>💎 <strong>Priority support</strong> from the team</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedGameLab;