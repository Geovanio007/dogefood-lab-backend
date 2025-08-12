// Game Configuration - Adjustable for Testing and Balancing
export const gameConfig = {
  // XP System
  xp: {
    baseXpPerCombo: 5,          // XP awarded for 2-ingredient combination
    bonusXpPerExtraIngredient: 3, // Bonus XP for each ingredient beyond 2
    xpCapPerLevel: 100,         // XP needed to level up
    levelUpBonus: 10,           // Bonus XP for leveling up
  },
  
  // Level Progression & Difficulty
  difficulty: {
    baseMultiplier: 1.0,        // Base difficulty multiplier
    scalingFactor: 0.2,         // How much difficulty increases per level
    maxMultiplier: 3.0,         // Maximum difficulty multiplier
    timeLimitEnabled: false,    // Enable time limits for mixing
    baseTimeLimit: 30,          // Base time limit in seconds
    timePenaltyPerLevel: 2,     // Reduce time limit by X seconds per level
  },
  
  // Ingredient System
  ingredients: {
    rarityMultiplier: {
      common: 1.0,
      rare: 1.5,
      epic: 2.0,
      legendary: 3.0
    },
    unlockLevels: {
      special: 2,               // Level required for special ingredients
      legendary: 5              // Level required for legendary ingredients
    }
  },
  
  // Visual & Animation
  animations: {
    xpGainDuration: 1000,       // Duration of XP gain animation (ms)
    levelUpDuration: 2000,      // Duration of level up animation (ms)
    sackDropDuration: 800,      // Duration of ingredient drop animation (ms)
    progressBarSpeed: 500,      // Speed of progress bar fill animation (ms)
  },
  
  // Sack System
  sack: {
    maxVisibleIngredients: 8,   // Maximum ingredients shown in sack
    completionThreshold: 5,     // Ingredients needed for recipe completion
    bonusXpPerCompletion: 25,   // Bonus XP for completing a recipe
  }
};

// Level-based difficulty calculation
export const calculateDifficulty = (level) => {
  const { baseMultiplier, scalingFactor, maxMultiplier } = gameConfig.difficulty;
  const difficulty = Math.min(
    baseMultiplier + (level - 1) * scalingFactor,
    maxMultiplier
  );
  return parseFloat(difficulty.toFixed(2));
};

// XP calculation based on ingredients and level
export const calculateXP = (ingredients, level, rarity = 'common') => {
  const baseXp = gameConfig.xp.baseXpPerCombo;
  const bonusXp = Math.max(0, ingredients.length - 2) * gameConfig.xp.bonusXpPerExtraIngredient;
  const rarityMultiplier = gameConfig.ingredients.rarityMultiplier[rarity] || 1.0;
  
  return Math.floor((baseXp + bonusXp) * rarityMultiplier);
};

// Time limit calculation
export const calculateTimeLimit = (level) => {
  if (!gameConfig.difficulty.timeLimitEnabled) return null;
  
  const baseTime = gameConfig.difficulty.baseTimeLimit;
  const penalty = gameConfig.difficulty.timePenaltyPerLevel;
  return Math.max(10, baseTime - (level - 1) * penalty); // Minimum 10 seconds
};