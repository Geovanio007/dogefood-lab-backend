import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { useToast } from './ui/use-toast';
import { useTelegram } from '../contexts/TelegramContext';

const GameLabNew = () => {
  const { address } = useAccount();
  const { isTelegram, telegramUser } = useTelegram();
  const { toast } = useToast();
  
  // Character and game state
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [showCharacterSelection, setShowCharacterSelection] = useState(false);
  const [playerData, setPlayerData] = useState(null);
  const [activeTreats, setActiveTreats] = useState([]);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Available ingredients (level-based)
  const [availableIngredients] = useState([
    { id: 1, name: 'Chicken', emoji: '🍗', level: 1, rarity: 'common' },
    { id: 2, name: 'Rice', emoji: '🍚', level: 1, rarity: 'common' },
    { id: 3, name: 'Vegetables', emoji: '🥕', level: 1, rarity: 'common' },
    { id: 4, name: 'Salmon', emoji: '🐟', level: 3, rarity: 'uncommon' },
    { id: 5, name: 'Beef', emoji: '🥩', level: 5, rarity: 'uncommon' },
    { id: 6, name: 'Honey', emoji: '🍯', level: 7, rarity: 'rare' },
    { id: 7, name: 'Berries', emoji: '🫐', level: 4, rarity: 'uncommon' },
    { id: 8, name: 'Truffle', emoji: '🍄', level: 10, rarity: 'epic' }
  ]);

  // Load character on component mount
  useEffect(() => {
    const checkCharacterSelection = async () => {
      // Clear any existing character selection for fresh start
      localStorage.removeItem('selectedCharacter');
      
      // Always show character selection first
      setShowCharacterSelection(true);
      setSelectedCharacter(null);
    };
    
    checkCharacterSelection();
  }, []);

  // Load player data
  useEffect(() => {
    if (address || (isTelegram && telegramUser)) {
      loadPlayerData();
    }
  }, [address, isTelegram, telegramUser]);

  // Timer update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadPlayerData = async () => {
    try {
      let endpoint;
      if (isTelegram && telegramUser) {
        endpoint = `${process.env.REACT_APP_BACKEND_URL}/api/player/telegram/${telegramUser.id}`;
      } else if (address) {
        endpoint = `${process.env.REACT_APP_BACKEND_URL}/api/player/${address}`;
      } else {
        return;
      }

      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setPlayerData(data);
        loadActiveTreats();
      }
    } catch (error) {
      console.error('Error loading player data:', error);
    }
  };

  const loadActiveTreats = async () => {
    try {
      let endpoint;
      if (isTelegram && telegramUser) {
        endpoint = `${process.env.REACT_APP_BACKEND_URL}/api/treats/player/telegram_${telegramUser.id}`;
      } else if (address) {
        endpoint = `${process.env.REACT_APP_BACKEND_URL}/api/treats/player/${address}`;  
      } else {
        return;
      }

      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        // Filter for active treats (not ready yet)
        const activeTreats = data.treats ? data.treats.filter(treat => 
          new Date(treat.ready_at).getTime() > Date.now()
        ) : [];
        setActiveTreats(activeTreats);
      }
    } catch (error) {
      console.error('Error loading active treats:', error);
      setActiveTreats([]); // Set empty array on error
    }
  };

  const handleIngredientSelect = (ingredient) => {
    if (selectedIngredients.find(ing => ing.id === ingredient.id)) {
      setSelectedIngredients(selectedIngredients.filter(ing => ing.id !== ingredient.id));
    } else if (selectedIngredients.length < 5) {
      setSelectedIngredients([...selectedIngredients, ingredient]);
    } else {
      toast({
        title: "Maximum ingredients reached",
        description: "You can only select up to 5 ingredients per treat.",
        variant: "destructive"
      });
    }
  };

  const handleMixTreat = async () => {
    if (selectedIngredients.length < 2) {
      toast({
        title: "Need more ingredients",
        description: "Select at least 2 ingredients to create a treat.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/treats/enhanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_address: address || `telegram_${telegramUser?.id}`,
          ingredients: selectedIngredients.map(ing => ing.name),
          season: 1
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: `${result.outcome.rarity} Treat Created! 🎉`,
          description: `Your ${result.outcome.rarity.toLowerCase()} treat is brewing for ${result.outcome.timer_duration_hours} hours!`,
          className: "bg-green-100 border-green-400"
        });
        
        setSelectedIngredients([]);
        loadActiveTreats();
        loadPlayerData();
      }
    } catch (error) {
      toast({
        title: "Error creating treat",
        description: "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeRemaining = (readyAt) => {
    const remaining = new Date(readyAt).getTime() - currentTime;
    if (remaining <= 0) return "Ready! 🎉";
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const getProgressPercentage = (readyAt) => {
    const startTime = new Date(readyAt).getTime() - (12 * 60 * 60 * 1000); // Assume 12h max
    const endTime = new Date(readyAt).getTime();
    const elapsed = currentTime - startTime;
    const total = endTime - startTime;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };

  if (showCharacterSelection) {
    const CharacterSelection = React.lazy(() => import('./CharacterSelection'));
    return (
      <React.Suspense fallback={<div>Loading...</div>}>
        <CharacterSelection 
          onCharacterSelected={(character) => {
            setSelectedCharacter(character);
            setShowCharacterSelection(false);
          }}
        />
      </React.Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Header with Character */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 mb-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {selectedCharacter && (
                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-yellow-400 shadow-lg">
                  <img 
                    src={selectedCharacter.image} 
                    alt={selectedCharacter.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">
                  🧪 DogeFood Laboratory
                </h1>
                {selectedCharacter && (
                  <p className="text-xl text-yellow-400">
                    Scientist: {selectedCharacter.name}
                  </p>
                )}
              </div>
            </div>
            
            {playerData && (
              <div className="text-right">
                <div className="text-white text-lg">
                  Level {playerData.level} • {playerData.points} Points
                </div>
                <div className="text-yellow-400">
                  {playerData.experience} XP
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Left Panel - Ingredient Selection */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* Ingredient Selection */}
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-2xl text-white flex items-center gap-3">
                  🧪 Select Ingredients
                  <Badge className="bg-blue-500 text-white">
                    {selectedIngredients.length}/5
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {availableIngredients
                    .filter(ing => !playerData || ing.level <= playerData.level)
                    .map((ingredient) => (
                    <div
                      key={ingredient.id}
                      onClick={() => handleIngredientSelect(ingredient)}
                      className={`relative p-4 rounded-xl cursor-pointer transition-all duration-300 ${
                        selectedIngredients.find(ing => ing.id === ingredient.id)
                          ? 'bg-yellow-400 text-gray-900 scale-105 shadow-lg'
                          : 'bg-white/20 text-white hover:bg-white/30 hover:scale-105'
                      }`}
                    >
                      <div className="text-4xl mb-2 text-center">
                        {ingredient.emoji}
                      </div>
                      <div className="text-center font-bold">
                        {ingredient.name}
                      </div>
                      <div className="text-xs text-center mt-1 opacity-80">
                        Level {ingredient.level}
                      </div>
                      
                      {selectedIngredients.find(ing => ing.id === ingredient.id) && (
                        <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                          ✓
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Selected Ingredients Display */}
                {selectedIngredients.length > 0 && (
                  <div className="mt-6 p-4 bg-white/20 rounded-xl">
                    <h4 className="text-white font-bold mb-3">Selected Ingredients:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedIngredients.map((ingredient) => (
                        <span
                          key={ingredient.id}
                          className="bg-yellow-400 text-gray-900 px-3 py-1 rounded-lg font-medium"
                        >
                          {ingredient.emoji} {ingredient.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mix Button */}
            <div className="text-center">
              <Button
                onClick={handleMixTreat}
                disabled={selectedIngredients.length < 2 || isLoading}
                className="text-2xl font-bold py-6 px-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl shadow-2xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                    Mixing...
                  </>
                ) : (
                  <>
                    🧪 Mix Treat ({selectedIngredients.length} ingredients)
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right Panel - Active Treats */}
          <div className="space-y-6">
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-2xl text-white flex items-center gap-3">
                  ⏱️ Active Treats
                  <Badge className="bg-purple-500 text-white">
                    {activeTreats.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeTreats.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">🧪</div>
                    <p className="text-white/70">No active treats</p>
                    <p className="text-white/50 text-sm">Mix some ingredients to get started!</p>
                  </div>
                ) : (
                  activeTreats.map((treat, index) => {
                    const isReady = new Date(treat.ready_at).getTime() <= currentTime;
                    const progress = getProgressPercentage(treat.ready_at);
                    
                    return (
                      <div
                        key={index}
                        className={`p-4 rounded-xl border-2 ${
                          isReady 
                            ? 'bg-green-100 border-green-400'
                            : 'bg-white/20 border-white/30'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className={`font-bold ${isReady ? 'text-green-800' : 'text-white'}`}>
                              {treat.rarity || 'Mystery'} Treat
                            </div>
                            <div className={`text-sm ${isReady ? 'text-green-600' : 'text-white/70'}`}>
                              {treat.ingredients?.join(', ') || 'Secret Recipe'}
                            </div>
                          </div>
                          <div className="text-2xl">
                            {isReady ? '🎉' : '⏳'}
                          </div>
                        </div>
                        
                        <Progress 
                          value={progress} 
                          className="mb-2"
                        />
                        
                        <div className={`text-center font-bold ${
                          isReady ? 'text-green-800' : 'text-white'
                        }`}>
                          {formatTimeRemaining(treat.ready_at)}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameLabNew;