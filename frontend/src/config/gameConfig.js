// Game Configuration - Adjustable for Testing and Balancing
export const gameConfig = {
  // XP System
  xp: {
    baseXpPerCombo: 5,          // XP awarded per successful mix
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
  
  // Level System
  levels: {
    maxLevel: 25,               // Maximum level cap
    ingredientsPerTier: 5,      // Number of ingredients per tier
  },
  
  // Ingredient System with Tiers
  ingredients: {
    rarityMultiplier: {
      common: 1.0,
      rare: 1.5,
      epic: 2.0,
      legendary: 3.0
    }
  },
  
  // Visual & Animation
  animations: {
    xpGainDuration: 1000,       // Duration of XP gain animation (ms)
    levelUpDuration: 2000,      // Duration of level up animation (ms)
    sackDropDuration: 800,      // Duration of ingredient drop animation (ms)
    progressBarSpeed: 500,      // Speed of progress bar fill animation (ms)
    ingredientUnlockDuration: 1200, // Duration of ingredient unlock animation
  },
  
  // Sack System
  sack: {
    maxVisibleIngredients: 8,   // Maximum ingredients shown in sack
    completionThreshold: 5,     // Ingredients needed for recipe completion
    bonusXpPerCompletion: 25,   // Bonus XP for completing a recipe
  }
};

// Complete ingredient database with tiers
export const ingredientDatabase = [
  // Tier 1 – Starter Ingredients (Levels 1–5)
  { id: '1', name: 'Basic Bone Biscuit', tier: 1, type: 'base', rarity: 'common', unlockLevel: 1, image: '🦴' },
  { id: '2', name: 'Chicken Crunch', tier: 1, type: 'protein', rarity: 'common', unlockLevel: 1, image: '🍗' },
  { id: '3', name: 'Beefy Bite', tier: 1, type: 'protein', rarity: 'common', unlockLevel: 2, image: '🥩' },
  { id: '4', name: 'Cheesy Kibble', tier: 1, type: 'flavor', rarity: 'common', unlockLevel: 3, image: '🧀' },
  { id: '5', name: 'Puppy Pea', tier: 1, type: 'veggie', rarity: 'common', unlockLevel: 4, image: '🟢' },
  
  // Tier 2 – Intermediate Ingredients (Levels 6–10)
  { id: '6', name: 'Salmon Surprise', tier: 2, type: 'protein', rarity: 'rare', unlockLevel: 6, image: '🐟' },
  { id: '7', name: 'Bacon Strip Delight', tier: 2, type: 'protein', rarity: 'rare', unlockLevel: 7, image: '🥓' },
  { id: '8', name: 'Peanut Woof Butter', tier: 2, type: 'flavor', rarity: 'rare', unlockLevel: 8, image: '🥜' },
  { id: '9', name: 'Carrot Chew', tier: 2, type: 'veggie', rarity: 'rare', unlockLevel: 9, image: '🥕' },
  { id: '10', name: 'Spinach Crunch', tier: 2, type: 'veggie', rarity: 'rare', unlockLevel: 10, image: '🥬' },
  
  // Tier 3 – Advanced Ingredients (Levels 11–15)
  { id: '11', name: 'Tuna Twister', tier: 3, type: 'protein', rarity: 'epic', unlockLevel: 11, image: '🐟' },
  { id: '12', name: 'Lamb & Mint Mix', tier: 3, type: 'protein', rarity: 'epic', unlockLevel: 12, image: '🐑' },
  { id: '13', name: 'Blueberry Bark', tier: 3, type: 'fruit', rarity: 'epic', unlockLevel: 13, image: '🫐' },
  { id: '14', name: 'Pumpkin Pooch Pie', tier: 3, type: 'veggie', rarity: 'epic', unlockLevel: 14, image: '🎃' },
  { id: '15', name: 'Apple Chew Cubes', tier: 3, type: 'fruit', rarity: 'epic', unlockLevel: 15, image: '🍎' },
  
  // Tier 4 – Expert Ingredients (Levels 16–20)
  { id: '16', name: 'Duck & Cranberry Kibble', tier: 4, type: 'protein', rarity: 'epic', unlockLevel: 16, image: '🦆' },
  { id: '17', name: 'Sweet Potato Snaps', tier: 4, type: 'veggie', rarity: 'epic', unlockLevel: 17, image: '🍠' },
  { id: '18', name: 'Banana Woof Wafers', tier: 4, type: 'fruit', rarity: 'epic', unlockLevel: 18, image: '🍌' },
  { id: '19', name: 'Honey Paw Pops', tier: 4, type: 'flavor', rarity: 'epic', unlockLevel: 19, image: '🍯' },
  { id: '20', name: 'Coconut Treat Bites', tier: 4, type: 'fruit', rarity: 'epic', unlockLevel: 20, image: '🥥' },
  
  // Tier 5 – Legendary Ingredients (Levels 21–25)
  { id: '21', name: 'Gold Dust Kibble', tier: 5, type: 'special', rarity: 'legendary', unlockLevel: 21, image: '✨' },
  { id: '22', name: 'Meteorite Meatball', tier: 5, type: 'special', rarity: 'legendary', unlockLevel: 22, image: '☄️' },
  { id: '23', name: 'Galactic Gravy', tier: 5, type: 'special', rarity: 'legendary', unlockLevel: 23, image: '🌌' },
  { id: '24', name: 'Diamond Bone Crunch', tier: 5, type: 'special', rarity: 'legendary', unlockLevel: 24, image: '💎' },
  { id: '25', name: 'Meme Magic Sauce', tier: 5, type: 'special', rarity: 'legendary', unlockLevel: 25, image: '🪄' },
];

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

// Get unlocked ingredients for a specific level
export const getUnlockedIngredients = (currentLevel) => {
  return ingredientDatabase.filter(ingredient => ingredient.unlockLevel <= currentLevel);
};

// Get ingredients unlocked at a specific level (for level up notifications)
export const getIngredientsUnlockedAtLevel = (level) => {
  return ingredientDatabase.filter(ingredient => ingredient.unlockLevel === level);
};

// Get tier information
export const getTierInfo = (tier) => {
  const tierNames = {
    1: 'Starter',
    2: 'Intermediate', 
    3: 'Advanced',
    4: 'Expert',
    5: 'Legendary'
  };
  
  const tierColors = {
    1: 'bg-green-100 text-green-800 border-green-300',
    2: 'bg-blue-100 text-blue-800 border-blue-300',
    3: 'bg-purple-100 text-purple-800 border-purple-300',
    4: 'bg-orange-100 text-orange-800 border-orange-300',
    5: 'bg-yellow-100 text-yellow-800 border-yellow-300'
  };
  
  return {
    name: tierNames[tier] || 'Unknown',
    color: tierColors[tier] || 'bg-gray-100 text-gray-800 border-gray-300'
  };
};

// Time limit calculation
export const calculateTimeLimit = (level) => {
  if (!gameConfig.difficulty.timeLimitEnabled) return null;
  
  const baseTime = gameConfig.difficulty.baseTimeLimit;
  const penalty = gameConfig.difficulty.timePenaltyPerLevel;
  return Math.max(10, baseTime - (level - 1) * penalty); // Minimum 10 seconds
};