import React, { useState, useEffect } from 'react';
import { Progress } from '../ui/progress';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { useGame } from '../../contexts/GameContext';
import { Star, Zap, Crown, Sparkles } from 'lucide-react';

// Real-time XP Progress Bar Component
export const XPProgressBar = () => {
  const { currentLevel, xpProgress, experience, gameConfig, xpAnimation } = useGame();
  const [animatedProgress, setAnimatedProgress] = useState(xpProgress);

  useEffect(() => {
    // Smooth animation for progress bar
    const timer = setTimeout(() => {
      setAnimatedProgress(xpProgress);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [xpProgress]);

  const progressPercentage = (animatedProgress / gameConfig.xp.xpCapPerLevel) * 100;

  return (
    <Card className="glass-panel mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <img 
              src="https://i.ibb.co/nSyTZHR/1000025490-removebg-preview.png"
              alt="Your Avatar"
              className="w-8 h-8 object-contain"
            />
            <div>
              <div className="font-bold text-lg text-yellow-600">Level {currentLevel}</div>
              <div className="text-sm text-gray-600">Master Creator</div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="font-semibold text-gray-800">
              {Math.floor(animatedProgress)} / {gameConfig.xp.xpCapPerLevel} XP
            </div>
            <div className="text-xs text-gray-500">
              Total: {experience.toLocaleString()} XP
            </div>
          </div>
        </div>
        
        {/* Animated Progress Bar */}
        <div className="relative">
          <Progress 
            value={progressPercentage} 
            className="h-4 bg-gray-200"
          />
          
          {/* XP Gain Animation */}
          {xpAnimation.active && (
            <div className="absolute -top-8 right-0 animate-bounce">
              <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                +{xpAnimation.amount} XP
              </div>
            </div>
          )}
          
          {/* Progress Glow Effect */}
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full opacity-30 transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        {/* Next Level Preview */}
        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
          <span>Level {currentLevel}</span>
          <span>{Math.floor(gameConfig.xp.xpCapPerLevel - animatedProgress)} XP to Level {currentLevel + 1}</span>
          <span>Level {currentLevel + 1}</span>
        </div>
      </CardContent>
    </Card>
  );
};

// Level Up Notification Component
export const LevelUpNotification = () => {
  const { levelUp, acknowledgeLevelUp } = useGame();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (levelUp.justLeveledUp) {
      setVisible(true);
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [levelUp.justLeveledUp]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      acknowledgeLevelUp();
    }, 300);
  };

  if (!visible || !levelUp.justLeveledUp) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-300">
      <Card className="glass-panel border-4 border-yellow-400 max-w-md mx-4 level-unlock-animation">
        <CardContent className="p-8 text-center">
          {/* Celebration Animation */}
          <div className="mb-6">
            <div className="relative inline-block">
              <Crown className="w-20 h-20 text-yellow-500 animate-bounce" />
              <div className="absolute -top-2 -right-2">
                <Sparkles className="w-8 h-8 text-orange-400 animate-spin" />
              </div>
            </div>
          </div>
          
          {/* Level Up Message */}
          <h2 className="text-4xl font-bold doge-gradient mb-4">
            LEVEL UP! 🎉
          </h2>
          
          <div className="mb-6">
            <div className="text-6xl font-bold text-yellow-600 mb-2">
              {levelUp.newLevel}
            </div>
            <div className="text-lg text-gray-700">
              You are now a Level {levelUp.newLevel} Master Creator!
            </div>
          </div>
          
          {/* Unlocked Features */}
          {levelUp.unlockedFeatures.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold text-green-600 mb-3 flex items-center justify-center gap-2">
                <Star className="w-5 h-5" />
                New Features Unlocked!
                <Star className="w-5 h-5" />
              </h3>
              <div className="space-y-2">
                {levelUp.unlockedFeatures.map((feature, index) => (
                  <Badge key={index} className="bg-green-100 text-green-800 mr-2">
                    ✨ {feature}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Character Celebration */}
          <div className="mb-6">
            <img 
              src="https://i.ibb.co/nSyTZHR/1000025490-removebg-preview.png"
              alt="Celebrating Character"
              className="w-16 h-16 object-contain mx-auto animate-bounce"
            />
            <div className="text-sm text-gray-600 mt-2">
              You're becoming a legendary creator! 🌟
            </div>
          </div>
          
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="doge-button px-6 py-3"
          >
            Continue Creating! 🚀
          </button>
        </CardContent>
      </Card>
    </div>
  );
};

// Ingredient Sack Component
export const IngredientSack = () => {
  const { ingredientSack, mixesThisLevel, gameConfig, ingredients } = useGame();
  const [droppingItem, setDroppingItem] = useState(null);

  useEffect(() => {
    // Animate new items dropping into sack
    if (ingredientSack.length > 0) {
      const latestItem = ingredientSack[ingredientSack.length - 1];
      setDroppingItem(latestItem);
      
      const timer = setTimeout(() => {
        setDroppingItem(null);
      }, gameConfig.animations.sackDropDuration);
      
      return () => clearTimeout(timer);
    }
  }, [ingredientSack.length, gameConfig.animations.sackDropDuration]);

  const completionPercentage = (mixesThisLevel / gameConfig.sack.completionThreshold) * 100;
  const isNearCompletion = completionPercentage >= 80;
  const isComplete = mixesThisLevel >= gameConfig.sack.completionThreshold;

  return (
    <Card className="glass-panel">
      <CardContent className="p-4">
        {/* Sack Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="text-2xl">🎒</div>
            <div>
              <div className="font-bold text-gray-800">Ingredient Sack</div>
              <div className="text-sm text-gray-600">
                {mixesThisLevel} / {gameConfig.sack.completionThreshold} mixes completed
              </div>
            </div>
          </div>
          
          {/* Completion Status */}
          <div className="text-right">
            {isComplete && (
              <Badge className="bg-green-500 text-white animate-pulse">
                Recipe Complete! 🎉
              </Badge>
            )}
            {isNearCompletion && !isComplete && (
              <Badge className="bg-orange-500 text-white">
                Almost Ready! ⚡
              </Badge>
            )}
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mb-4">
          <Progress 
            value={completionPercentage} 
            className={`h-3 ${isComplete ? 'animate-pulse' : ''}`}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{Math.floor(completionPercentage)}% complete</span>
            <span>{Math.max(0, gameConfig.sack.completionThreshold - mixesThisLevel)} more to bonus</span>
          </div>
        </div>
        
        {/* Sack Contents */}
        <div className="relative bg-gradient-to-b from-amber-100 to-amber-200 rounded-xl p-4 min-h-[120px] border-2 border-amber-300">
          {/* Empty State */}
          {mixesThisLevel === 0 && (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-2">📥</div>
              <div className="text-sm">
                Mix ingredients to fill your sack!
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Complete {gameConfig.sack.completionThreshold} mixes for bonus XP
              </div>
            </div>
          )}
          
          {/* Mix Counter Visualization */}
          {mixesThisLevel > 0 && (
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: gameConfig.sack.completionThreshold }, (_, index) => {
                const isFilled = index < mixesThisLevel;
                const isLatest = index === mixesThisLevel - 1;
                const isDroppingItem = droppingItem && isLatest;
                
                return (
                  <div
                    key={index}
                    className={`
                      aspect-square rounded-lg border-2 flex items-center justify-center text-lg font-bold transition-all duration-300
                      ${isFilled 
                        ? 'bg-green-100 border-green-400 text-green-700' 
                        : 'bg-gray-100 border-gray-300 text-gray-400'
                      }
                      ${isDroppingItem ? 'animate-bounce scale-110' : ''}
                    `}
                  >
                    {isFilled ? '✓' : (index + 1)}
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Recent Treats Preview */}
          {ingredientSack.length > 0 && (
            <div className="mt-4 border-t border-amber-400 pt-4">
              <div className="text-xs font-medium text-amber-800 mb-2">Recent Treats:</div>
              <div className="flex gap-2 overflow-x-auto">
                {ingredientSack.slice(-5).map((item, index) => (
                  <div
                    key={item.id}
                    className="flex-shrink-0 bg-white/80 rounded-lg p-2 text-center border border-amber-300 min-w-[60px]"
                  >
                    <div className="text-base mb-1">
                      {item.rarity === 'Legendary' ? '🌟' : 
                       item.rarity === 'Epic' ? '⭐' : 
                       item.rarity === 'Rare' ? '✨' : '🍪'}
                    </div>
                    <div className="text-xs text-gray-600">
                      {item.ingredients.length}x
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Completion Animation */}
          {isComplete && (
            <div className="absolute inset-0 flex items-center justify-center bg-green-100/90 rounded-xl animate-in fade-in duration-500">
              <div className="text-center animate-bounce">
                <div className="text-4xl mb-2">🎉</div>
                <div className="font-bold text-green-800">Recipe Complete!</div>
                <div className="text-sm text-green-600">+{gameConfig.sack.bonusXpPerCompletion} Bonus XP</div>
                <div className="text-xs text-green-500 mt-1">Sack will reset after bonus</div>
              </div>
            </div>
          )}
        </div>
        
        {/* Sack Tips */}
        <div className="text-xs text-gray-500 mt-3 text-center">
          💡 Complete {gameConfig.sack.completionThreshold} successful mixes to unlock +{gameConfig.sack.bonusXpPerCompletion} bonus XP!
        </div>
      </CardContent>
    </Card>
  );
};