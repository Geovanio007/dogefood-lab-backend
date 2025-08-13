import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useGame } from '../contexts/GameContext';
import WalletRegistration from './WalletRegistration';
import TreatTimer from './TreatTimer';
import { ArrowLeft, Beaker, Sparkles, Clock, Star, Crown, Shuffle } from 'lucide-react';

const EnhancedGameLab = () => {
  const { isConnected } = useAccount();
  const {
    // State
    player,
    walletAddress,
    isRegistered,
    needsRegistration,
    showRegistration,
    currentLevel,
    experience,
    points,
    availableIngredients,
    mainIngredients,
    selectedIngredients,
    selectedMainIngredient,
    brewingTreats,
    readyTreats,
    activeTimers,
    mixingInProgress,
    canCreateTreat,
    
    // Actions
    registerPlayer,
    selectIngredient,
    selectMainIngredient,
    clearSelection,
    createTreat,
    shuffleIngredients,
    showNotification,
    checkBrewingTreats
  } = useGame();

  const [selectedIngredientIds, setSelectedIngredientIds] = useState([]);

  // Handle wallet registration completion
  const handleRegistrationComplete = (playerData) => {
    console.log('Registration completed:', playerData);
    showNotification({
      type: 'success',
      title: 'Welcome to DogeFood Lab!',
      message: `Ready to start creating treats, ${playerData.nickname}!`
    });
  };

  // Handle ingredient selection
  const handleIngredientClick = (ingredient) => {
    if (selectedIngredients.find(ing => ing.id === ingredient.id)) {
      // Deselect ingredient
      selectIngredient(ingredient);
      setSelectedIngredientIds(prev => prev.filter(id => id !== ingredient.id));
    } else if (selectedIngredients.length < 3) {
      // Select ingredient (max 3)
      selectIngredient(ingredient);
      setSelectedIngredientIds(prev => [...prev, ingredient.id]);
    } else {
      showNotification({
        type: 'warning',
        title: 'Too Many Ingredients',
        message: 'You can select up to 3 ingredients maximum.'
      });
    }
  };

  // Handle main ingredient selection
  const handleMainIngredientClick = (ingredient) => {
    selectMainIngredient(ingredient);
  };

  // Handle treat creation
  const handleCreateTreat = async () => {
    if (!canCreateTreat) {
      showNotification({
        type: 'error',
        title: 'Cannot Create Treat',
        message: 'Select at least 2 ingredients and 1 main ingredient.'
      });
      return;
    }

    const treatName = `${selectedMainIngredient?.name} Special`;
    await createTreat(treatName, selectedIngredients, selectedMainIngredient);
  };

  // Handle timer completion
  const handleTimerComplete = (treatId) => {
    showNotification({
      type: 'success',
      title: 'Treat Ready!',
      message: 'Your treat has finished brewing and is ready to collect!'
    });
    checkBrewingTreats();
  };

  // Get ingredient rarity color
  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'legendary': return 'border-yellow-400 bg-yellow-50';
      case 'epic': return 'border-purple-400 bg-purple-50';
      case 'rare': return 'border-blue-400 bg-blue-50';
      case 'uncommon': return 'border-green-400 bg-green-50';
      default: return 'border-gray-400 bg-gray-50';
    }
  };

  // Show registration screen if needed
  if (!isConnected || needsRegistration || showRegistration) {
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

          {/* Registration Component */}
          <WalletRegistration 
            onRegistrationComplete={handleRegistrationComplete}
            registeredPlayers={player ? [player] : []}
          />
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
              <p className="text-blue-600 font-medium">
                Welcome back, {player?.nickname || 'Scientist'}!
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
            {/* Ingredient Selection */}
            <Card className="game-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="playful-title text-white text-2xl">
                    🥄 Ingredient Shelf
                  </CardTitle>
                  <Button 
                    onClick={shuffleIngredients}
                    className="doge-button"
                    size="sm"
                  >
                    <Shuffle size={16} className="mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-white/80 playful-text">
                  Select up to 3 ingredients to mix together:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {availableIngredients.map((ingredient) => {
                    const isSelected = selectedIngredients.find(ing => ing.id === ingredient.id);
                    return (
                      <div
                        key={ingredient.id}
                        onClick={() => handleIngredientClick(ingredient)}
                        className={`ingredient-card cursor-pointer transition-all duration-300 ${
                          isSelected ? 'selected' : ''
                        } ${getRarityColor(ingredient.rarity)}`}
                      >
                        <div className="text-3xl mb-2">{ingredient.emoji}</div>
                        <div className="font-bold text-sm">{ingredient.name}</div>
                        <div className="text-xs text-gray-600 capitalize">{ingredient.type}</div>
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <Star className="w-5 h-5 text-yellow-500 fill-current" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Main Ingredient Selection */}
            <Card className="game-card">
              <CardHeader>
                <CardTitle className="playful-title text-white text-2xl">
                  🍖 Main Ingredient
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-white/80 playful-text">
                  Choose the main ingredient for your treat:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {mainIngredients.map((ingredient) => {
                    const isSelected = selectedMainIngredient?.id === ingredient.id;
                    return (
                      <div
                        key={ingredient.id}
                        onClick={() => handleMainIngredientClick(ingredient)}
                        className={`ingredient-card cursor-pointer transition-all duration-300 ${
                          isSelected ? 'selected ring-4 ring-yellow-400' : ''
                        }`}
                      >
                        <div className="text-4xl mb-2">{ingredient.emoji}</div>
                        <div className="font-bold text-sm">{ingredient.name}</div>
                        <div className="text-xs text-gray-600 capitalize">{ingredient.type}</div>
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <Crown className="w-5 h-5 text-yellow-500 fill-current" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Mixing Station */}
            <Card className="game-card">
              <CardHeader>
                <CardTitle className="playful-title text-white text-2xl">
                  🧪 Your Mixing Station
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Selected Ingredients Display */}
                <div className="space-y-4">
                  <h4 className="font-bold text-white playful-text">Selected Ingredients:</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedIngredients.map((ingredient) => (
                      <Badge key={ingredient.id} className="vip-badge">
                        {ingredient.emoji} {ingredient.name}
                      </Badge>
                    ))}
                    {selectedMainIngredient && (
                      <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
                        👑 {selectedMainIngredient.emoji} {selectedMainIngredient.name} (Main)
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Mixing Bowl Visual */}
                <div className="flex justify-center">
                  <div className="mixing-bowl">
                    {mixingInProgress && (
                      <div className="mixing-animation">
                        <Sparkles className="w-8 h-8 text-yellow-400" />
                      </div>
                    )}
                    {canCreateTreat && !mixingInProgress && (
                      <div className="sparkle-effect">
                        <Beaker className="w-8 h-8 text-blue-400" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    onClick={handleCreateTreat}
                    disabled={!canCreateTreat || mixingInProgress}
                    className="doge-button text-lg px-8 py-3"
                  >
                    {mixingInProgress ? (
                      <>
                        <div className="spinner mr-2"></div>
                        Creating Treat...
                      </>
                    ) : (
                      <>
                        <Beaker className="mr-2" size={20} />
                        Create Treat (3 Hour Timer)
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={clearSelection}
                    variant="outline"
                    className="border-white text-white hover:bg-white/20"
                  >
                    Clear Selection
                  </Button>
                </div>

                {/* Instructions */}
                <div className="text-center text-white/80 playful-text text-sm">
                  <p>💡 Tip: Different ingredient combinations create different treat rarities!</p>
                  <p>⏰ Each treat takes 3 hours to brew - perfect for strategic planning!</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Active Timers */}
            {activeTimers.length > 0 && (
              <Card className="game-card">
                <CardHeader>
                  <CardTitle className="playful-title text-white text-xl">
                    ⏰ Brewing Treats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeTimers.map((timer) => (
                    <TreatTimer
                      key={timer.treatId}
                      treatId={timer.treatId}
                      startTime={timer.startTime}
                      duration={timer.duration}
                      treatName={timer.treatName}
                      onComplete={handleTimerComplete}
                      size="small"
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Ready Treats */}
            {readyTreats.length > 0 && (
              <Card className="game-card">
                <CardHeader>
                  <CardTitle className="playful-title text-white text-xl">
                    ✨ Ready Treats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {readyTreats.map((treat) => (
                    <div key={treat.id} className="treat-card ready p-4 rounded-lg">
                      <h4 className="font-bold text-white">{treat.name}</h4>
                      <p className="text-white/80 text-sm capitalize">
                        Rarity: {treat.rarity}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Sparkles className="w-4 h-4 text-yellow-400" />
                        <span className="text-white text-sm">Ready to collect!</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Instructions Card */}
            <Card className="game-card">
              <CardHeader>
                <CardTitle className="playful-title text-white text-xl">
                  📋 How to Play
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-white/90 playful-text space-y-2 text-sm">
                  <p>1. 🥄 Select 2-3 ingredients from the shelf</p>
                  <p>2. 🍖 Choose a main ingredient</p>
                  <p>3. 🧪 Mix them in the station</p>
                  <p>4. ⏰ Wait 3 hours for brewing</p>
                  <p>5. ✨ Collect your finished treat!</p>
                  <p>6. 🏆 Earn XP and compete on leaderboards!</p>
                </div>
              </CardContent>
            </Card>

            {/* Level Progress */}
            <Card className="game-card">
              <CardHeader>
                <CardTitle className="playful-title text-white text-xl">
                  📈 Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-white">
                    <span>Level {currentLevel}</span>
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
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedGameLab;