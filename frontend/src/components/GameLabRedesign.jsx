import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import INGREDIENT_ICONS from '../config/ingredientIcons';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Helper to get ingredient icon
const getIcon = (ingredientId) => {
  const data = INGREDIENT_ICONS[ingredientId];
  return data?.icon || null;
};

const getEmoji = (ingredientId) => {
  const data = INGREDIENT_ICONS[ingredientId];
  return data?.emoji || '❓';
};

// Category styling
const CATEGORY_STYLES = {
  Core: {
    gradient: 'from-yellow-500/30 to-orange-500/30',
    border: 'border-yellow-500/60',
    glow: 'hover:shadow-yellow-500/40',
    text: 'text-yellow-400',
    bg: 'bg-yellow-500/20'
  },
  Elonverse: {
    gradient: 'from-blue-500/30 to-cyan-500/30',
    border: 'border-blue-500/60',
    glow: 'hover:shadow-cyan-500/40',
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/20'
  },
  Space: {
    gradient: 'from-purple-500/30 to-indigo-500/30',
    border: 'border-purple-500/60',
    glow: 'hover:shadow-purple-500/40',
    text: 'text-purple-400',
    bg: 'bg-purple-500/20'
  },
  Lab: {
    gradient: 'from-green-500/30 to-emerald-500/30',
    border: 'border-green-500/60',
    glow: 'hover:shadow-green-500/40',
    text: 'text-green-400',
    bg: 'bg-green-500/20'
  },
  Mythic: {
    gradient: 'from-yellow-400/30 via-pink-500/30 to-purple-500/30',
    border: 'border-yellow-400/70',
    glow: 'hover:shadow-yellow-400/50',
    text: 'text-yellow-300',
    bg: 'bg-gradient-to-r from-yellow-500/20 via-pink-500/20 to-purple-500/20'
  }
};

// Rarity colors and emojis
const RARITY_STYLES = {
  Common: { color: '#9CA3AF', emoji: '⚪', bg: 'bg-gray-500/30' },
  Uncommon: { color: '#22C55E', emoji: '🟢', bg: 'bg-green-500/30' },
  Rare: { color: '#3B82F6', emoji: '🔵', bg: 'bg-blue-500/30' },
  Epic: { color: '#A855F7', emoji: '🟣', bg: 'bg-purple-500/30' },
  Legendary: { color: '#F59E0B', emoji: '🟡', bg: 'bg-yellow-500/30' },
  Mythic: { color: '#EF4444', emoji: '🔴', bg: 'bg-red-500/30' }
};

const GameLabRedesign = ({ playerAddress }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Player data
  const [playerData, setPlayerData] = useState(null);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [playerXP, setPlayerXP] = useState(0);
  const [playerPoints, setPlayerPoints] = useState(0);
  
  // Ingredients
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Recipe validation
  const [validation, setValidation] = useState(null);
  
  // Brewing
  const [isBrewing, setIsBrewing] = useState(false);
  const [brewResult, setBrewResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  
  // Active treats
  const [activeTreats, setActiveTreats] = useState([]);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Load player data
  const loadPlayerData = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/player/${playerAddress}`);
      if (response.ok) {
        const data = await response.json();
        setPlayerData(data);
        setPlayerLevel(data.level || 1);
        setPlayerXP(data.experience || 0);
        setPlayerPoints(data.points || 0);
      }
    } catch (err) {
      console.error('Error loading player:', err);
    }
  }, [playerAddress]);

  // Load ingredients
  const loadIngredients = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/ingredients/unlocked/${playerLevel}`);
      if (response.ok) {
        const data = await response.json();
        
        // Flatten ingredients from categories
        const allIngredients = [];
        Object.entries(data.unlocked_by_category || {}).forEach(([category, items]) => {
          items.forEach(item => allIngredients.push({ ...item, category }));
        });
        
        setIngredients(allIngredients);
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Error loading ingredients:', err);
    }
  }, [playerLevel]);

  // Load active treats
  const loadActiveTreats = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/treats/${playerAddress}/active`);
      if (response.ok) {
        const data = await response.json();
        setActiveTreats(data.treats || []);
      }
    } catch (err) {
      console.error('Error loading active treats:', err);
    }
  }, [playerAddress]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadPlayerData();
      await loadIngredients();
      await loadActiveTreats();
      setLoading(false);
    };
    init();
  }, [loadPlayerData, loadIngredients, loadActiveTreats]);

  // Timer update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Validate recipe when ingredients change
  useEffect(() => {
    const validateRecipe = async () => {
      if (selectedIngredients.length === 0) {
        setValidation(null);
        return;
      }
      
      try {
        const response = await fetch(`${API_URL}/api/ingredients/validate-recipe?player_level=${playerLevel}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(selectedIngredients)
        });
        
        if (response.ok) {
          const data = await response.json();
          setValidation(data);
        }
      } catch (err) {
        console.error('Error validating recipe:', err);
      }
    };
    
    validateRecipe();
  }, [selectedIngredients, playerLevel]);

  // Toggle ingredient selection
  const toggleIngredient = (ingredient) => {
    setSelectedIngredients(prev => {
      if (prev.includes(ingredient.id)) {
        return prev.filter(id => id !== ingredient.id);
      }
      if (prev.length >= 5) {
        return prev; // Max 5 ingredients
      }
      return [...prev, ingredient.id];
    });
  };

  // Create treat
  const handleCreateTreat = async () => {
    if (selectedIngredients.length < 1) return;
    
    setIsBrewing(true);
    setBrewResult(null);
    
    try {
      const response = await fetch(`${API_URL}/api/treats/enhanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_address: playerAddress,
          ingredients: selectedIngredients,
          player_level: playerLevel
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setBrewResult(data);
        setShowResult(true);
        setSelectedIngredients([]);
        
        // Reload data
        await loadPlayerData();
        await loadActiveTreats();
      } else {
        throw new Error('Failed to create treat');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsBrewing(false);
    }
  };

  // Calculate XP progress to next level
  const xpForNextLevel = playerLevel * 100;
  const xpProgress = (playerXP % xpForNextLevel) / xpForNextLevel * 100;

  // Filter ingredients by category
  const filteredIngredients = selectedCategory === 'all' 
    ? ingredients 
    : ingredients.filter(ing => ing.category === selectedCategory);

  // Get selected ingredients data
  const selectedIngredientsData = selectedIngredients.map(id => 
    ingredients.find(ing => ing.id === id)
  ).filter(Boolean);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-400 via-sky-500 to-blue-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-bounce text-6xl mb-4">🧪</div>
          <div className="text-white text-xl font-bold animate-pulse drop-shadow-lg">Loading Laboratory...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-400 via-sky-500 to-blue-600 overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-yellow-400/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-sky-300/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-white/20 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 p-4 max-w-7xl mx-auto">
        {/* Header with Player Stats */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {/* Player Card */}
          <Card className="flex-1 bg-gradient-to-br from-sky-600/95 to-blue-700/95 backdrop-blur-xl border-sky-400/50 overflow-hidden shadow-xl shadow-sky-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-3xl shadow-lg shadow-yellow-500/40">
                    🐕
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-sky-500 rounded-full px-2 py-0.5 text-xs font-bold text-white shadow-md">
                    Lv.{playerLevel}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-white font-bold text-lg truncate drop-shadow-md">
                    {playerAddress?.slice(0, 8)}...{playerAddress?.slice(-4)}
                  </div>
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-yellow-300 font-semibold">XP</span>
                      <span className="text-white">{playerXP % xpForNextLevel}/{xpForNextLevel}</span>
                    </div>
                    <Progress value={xpProgress} className="h-2 bg-sky-900/50" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="flex gap-4">
            <Card className="bg-gradient-to-br from-yellow-400/90 to-yellow-500/90 backdrop-blur-xl border-yellow-300 min-w-[120px] shadow-lg shadow-yellow-500/30">
              <CardContent className="p-4 text-center">
                <div className="text-3xl mb-1">🏆</div>
                <div className="text-2xl font-bold text-white drop-shadow-md">{playerPoints}</div>
                <div className="text-xs text-yellow-100">Points</div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-sky-400/90 to-sky-500/90 backdrop-blur-xl border-sky-300 min-w-[120px] shadow-lg shadow-sky-500/30">
              <CardContent className="p-4 text-center">
                <div className="text-3xl mb-1">🧪</div>
                <div className="text-2xl font-bold text-white drop-shadow-md">{activeTreats.length}</div>
                <div className="text-xs text-sky-100">Brewing</div>
              </CardContent>
            </Card>
          </div>

          {/* Back Button */}
          <Button 
            onClick={() => navigate('/')}
            className="bg-yellow-500 hover:bg-yellow-400 text-white font-bold shadow-lg shadow-yellow-500/30 border-0"
          >
            ← Menu
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Mixing Cauldron */}
          <div className="lg:col-span-1">
            <Card className="bg-gradient-to-br from-sky-600/95 to-blue-700/95 backdrop-blur-xl border-sky-400/50 sticky top-4 shadow-xl shadow-sky-500/20">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 drop-shadow-md">
                  <span className="text-3xl">🔮</span> Mixing Cauldron
                </h2>

                {/* Selected Ingredients Slots */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {[0, 1, 2, 3, 4].map(index => {
                    const ingredient = selectedIngredientsData[index];
                    const iconUrl = ingredient ? getIcon(ingredient.id) : null;
                    return (
                      <div
                        key={index}
                        className={`aspect-square rounded-xl border-2 border-dashed flex items-center justify-center transition-all overflow-hidden ${
                          ingredient 
                            ? `bg-gradient-to-br ${CATEGORY_STYLES[ingredient.category]?.gradient} border-solid ${CATEGORY_STYLES[ingredient.category]?.border}` 
                            : 'border-white/20 bg-white/5'
                        }`}
                        onClick={() => ingredient && toggleIngredient(ingredient)}
                      >
                        {ingredient ? (
                          <div className="text-center cursor-pointer hover:scale-110 transition-transform p-1">
                            {iconUrl ? (
                              <img 
                                src={iconUrl} 
                                alt={ingredient.name}
                                className="w-full h-full object-contain"
                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                              />
                            ) : null}
                            <div className={`text-2xl ${iconUrl ? 'hidden' : ''}`}>{ingredient.emoji}</div>
                          </div>
                        ) : (
                          <div className="text-white/30 text-xl">+</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Recipe Info */}
                {validation && (
                  <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white/70 text-sm">Max Rarity:</span>
                      <Badge className={`${RARITY_STYLES[validation.max_possible_rarity]?.bg} text-white`}>
                        {RARITY_STYLES[validation.max_possible_rarity]?.emoji} {validation.max_possible_rarity}
                      </Badge>
                    </div>
                    
                    {validation.special_effects.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {validation.special_effects.map((effect, i) => (
                          <Badge key={i} variant="outline" className="text-xs border-yellow-400/50 text-yellow-300">
                            ✨ {effect}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {validation.has_mythic_catalyst && (
                      <div className="mt-2 text-yellow-300 text-xs flex items-center gap-1">
                        <span>🌟</span> Mythic catalyst active!
                      </div>
                    )}
                  </div>
                )}

                {/* Rarity Chances */}
                <div className="mb-4">
                  <div className="text-sky-200 text-xs mb-2 font-semibold">Possible Rarities:</div>
                  <div className="flex flex-wrap gap-1">
                    {['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'].map(rarity => {
                      const canGet = validation?.possible_rarities?.includes(rarity);
                      return (
                        <Badge 
                          key={rarity}
                          className={`text-xs ${canGet ? RARITY_STYLES[rarity]?.bg : 'bg-white/10 opacity-40'} text-white`}
                        >
                          {RARITY_STYLES[rarity]?.emoji}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                {/* Create Button */}
                <Button
                  onClick={handleCreateTreat}
                  disabled={selectedIngredients.length < 1 || isBrewing}
                  className={`w-full h-14 text-lg font-bold transition-all ${
                    selectedIngredients.length >= 1 && !isBrewing
                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-white shadow-lg shadow-yellow-500/40'
                      : 'bg-sky-800/50 cursor-not-allowed text-white/50'
                  }`}
                >
                  {isBrewing ? (
                    <span className="animate-pulse">🔄 Brewing...</span>
                  ) : (
                    <span>🧪 Mix Treat ({selectedIngredients.length}/5)</span>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Middle: Ingredient Grid */}
          <div className="lg:col-span-2">
            <Card className="bg-gradient-to-br from-sky-600/95 to-blue-700/95 backdrop-blur-xl border-sky-400/50 shadow-xl shadow-sky-500/20">
              <CardContent className="p-6">
                {/* Category Tabs */}
                <div className="flex flex-wrap gap-2 mb-6">
                  <Button
                    onClick={() => setSelectedCategory('all')}
                    className={`${selectedCategory === 'all' ? 'bg-yellow-400 text-white' : 'bg-white/20 text-white'} hover:bg-yellow-400/80 border-0`}
                    size="sm"
                  >
                    All ({ingredients.length})
                  </Button>
                  {Object.keys(CATEGORY_STYLES).map(cat => {
                    const count = ingredients.filter(i => i.category === cat).length;
                    if (count === 0) return null;
                    return (
                      <Button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`${selectedCategory === cat ? CATEGORY_STYLES[cat].bg + ' border-2' : 'bg-white/20'} hover:bg-white/30 border ${CATEGORY_STYLES[cat].border}`}
                        size="sm"
                      >
                        <span className={selectedCategory === cat ? 'text-white' : CATEGORY_STYLES[cat].text}>{cat} ({count})</span>
                      </Button>
                    );
                  })}
                </div>

                {/* Ingredients Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredIngredients.map(ingredient => {
                    const isSelected = selectedIngredients.includes(ingredient.id);
                    const style = CATEGORY_STYLES[ingredient.category] || CATEGORY_STYLES.Core;
                    const iconUrl = getIcon(ingredient.id);
                    
                    return (
                      <div
                        key={ingredient.id}
                        onClick={() => toggleIngredient(ingredient)}
                        className={`
                          relative p-3 rounded-xl cursor-pointer transition-all duration-200
                          ${isSelected 
                            ? `bg-gradient-to-br ${style.gradient} border-2 ${style.border} scale-105 shadow-lg ${style.glow}` 
                            : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/30 hover:scale-102'
                          }
                        `}
                      >
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg z-10">
                            ✓
                          </div>
                        )}
                        
                        <div className="text-center">
                          {/* Icon/Image Container */}
                          <div className="w-16 h-16 mx-auto mb-2 relative">
                            {iconUrl ? (
                              <img 
                                src={iconUrl} 
                                alt={ingredient.name}
                                className="w-full h-full object-contain transform hover:scale-110 transition-transform drop-shadow-lg"
                                onError={(e) => { 
                                  e.target.style.display = 'none'; 
                                  e.target.parentElement.querySelector('.emoji-fallback').style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className={`emoji-fallback text-4xl ${iconUrl ? 'hidden' : 'flex'} items-center justify-center h-full`}>
                              {ingredient.emoji}
                            </div>
                          </div>
                          
                          <div className="text-white font-medium text-sm truncate">
                            {ingredient.name}
                          </div>
                          <div className={`text-xs ${style.text} mt-1`}>
                            {ingredient.category}
                          </div>
                          {ingredient.special_effect !== 'None' && (
                            <Badge variant="outline" className="mt-2 text-xs border-purple-500/50 text-purple-300">
                              {ingredient.special_effect}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredIngredients.length === 0 && (
                  <div className="text-center py-12 text-white/50">
                    <div className="text-4xl mb-4">🔒</div>
                    <p>No ingredients available in this category yet.</p>
                    <p className="text-sm mt-2">Level up to unlock more!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Active Treats Section */}
        {activeTreats.length > 0 && (
          <Card className="mt-6 bg-gradient-to-br from-sky-600/95 to-blue-700/95 backdrop-blur-xl border-sky-400/50 shadow-xl shadow-sky-500/20">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 drop-shadow-md">
                <span className="text-3xl animate-bounce">⏳</span> Active Brews
              </h2>
              
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeTreats.map((treat, index) => {
                  const readyAt = new Date(treat.ready_at).getTime();
                  const createdAt = new Date(treat.created_at).getTime();
                  const total = readyAt - createdAt;
                  const elapsed = currentTime - createdAt;
                  const progress = Math.min(100, (elapsed / total) * 100);
                  const isReady = currentTime >= readyAt;
                  const remaining = Math.max(0, readyAt - currentTime);
                  
                  const hours = Math.floor(remaining / 3600000);
                  const minutes = Math.floor((remaining % 3600000) / 60000);
                  const seconds = Math.floor((remaining % 60000) / 1000);
                  
                  const rarityStyle = RARITY_STYLES[treat.rarity] || RARITY_STYLES.Common;
                  
                  return (
                    <div
                      key={treat.id || index}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        isReady 
                          ? 'bg-gradient-to-br from-yellow-400/40 to-yellow-500/40 border-yellow-400 animate-pulse' 
                          : `bg-white/10 border-white/30`
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{rarityStyle.emoji}</span>
                          <div>
                            <div className="text-white font-bold drop-shadow-md">{treat.rarity} Treat</div>
                            <div className="text-sky-200 text-xs">
                              {treat.ingredients?.length || 0} ingredients
                            </div>
                          </div>
                        </div>
                        {isReady ? (
                          <Badge className="bg-yellow-400 text-white animate-bounce shadow-lg">Ready!</Badge>
                        ) : (
                          <Badge className={rarityStyle.bg + ' text-white'}>Brewing</Badge>
                        )}
                      </div>
                      
                      <Progress value={progress} className="h-3 mb-2" />
                      
                      <div className="text-center">
                        {isReady ? (
                          <div className="text-yellow-300 font-bold text-lg drop-shadow-md">🎉 Ready to Collect!</div>
                        ) : (
                          <div className="text-white font-mono text-lg drop-shadow-md">
                            {hours > 0 && `${hours}h `}{minutes}m {seconds}s
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Result Modal */}
      {showResult && brewResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="max-w-md w-full bg-gradient-to-b from-sky-500 via-sky-600 to-blue-700 border-sky-400 overflow-hidden animate-in zoom-in-95 duration-300 shadow-2xl shadow-sky-500/30">
            <CardContent className="p-8 text-center">
              <div className="text-6xl mb-4 animate-bounce">
                {RARITY_STYLES[brewResult.outcome?.rarity]?.emoji || '🧪'}
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">
                {brewResult.outcome?.rarity} Treat Created!
              </h2>
              
              <div className="grid grid-cols-2 gap-4 my-6">
                <div className="bg-yellow-400/90 rounded-xl p-3 shadow-lg">
                  <div className="text-3xl">🏆</div>
                  <div className="text-white font-bold text-xl drop-shadow-md">
                    +{brewResult.outcome?.points_reward || 0}
                  </div>
                  <div className="text-yellow-100 text-xs">Points</div>
                </div>
                <div className="bg-sky-400/90 rounded-xl p-3 shadow-lg">
                  <div className="text-3xl">⭐</div>
                  <div className="text-white font-bold text-xl drop-shadow-md">
                    +{brewResult.outcome?.xp_reward || 0}
                  </div>
                  <div className="text-sky-100 text-xs">XP</div>
                </div>
              </div>
              
              <div className="bg-white/20 rounded-xl p-4 mb-6">
                <div className="text-sky-200 text-sm mb-2">Brewing Time</div>
                <div className="text-white font-bold text-lg drop-shadow-md">
                  ⏱️ {brewResult.outcome?.timer_duration_hours || 0} hours
                </div>
              </div>
              
              <Button
                onClick={() => setShowResult(false)}
                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-white font-bold shadow-lg shadow-yellow-500/40"
              >
                Awesome! 🎉
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default GameLabRedesign;
