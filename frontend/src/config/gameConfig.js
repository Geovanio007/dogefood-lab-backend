// Enhanced Game Configuration for Treat Creation System
export const gameConfig = {
  // XP System
  xp: {
    baseXpPerCombo: 10,          // XP awarded per successful mix
    bonusXpPerExtraIngredient: 5, // Bonus XP for each ingredient beyond 2
    xpCapPerLevel: 100,          // XP needed to level up
    levelUpBonus: 25,            // Bonus XP for leveling up
  },
  
  // Level Progression & Difficulty
  difficulty: {
    baseMultiplier: 1.0,         // Base difficulty multiplier
    scalingFactor: 0.15,         // How much difficulty increases per level
    maxMultiplier: 2.5,          // Maximum difficulty multiplier
  },
  
  // Level System
  levels: {
    maxLevel: 10,                // Maximum level cap for this version
    ingredientsPerLevel: 2,      // New ingredients unlocked per level
  },
  
  // Treat Timer System (3 hours)
  timer: {
    treatCreationTime: 3 * 60 * 60 * 1000, // 3 hours in milliseconds
    maxActiveTreats: 3,          // Maximum treats that can be brewing at once
  },
  
  // Animation settings
  animations: {
    xpGainDuration: 1500,        // Duration of XP gain animation (ms)
    levelUpDuration: 3000,       // Duration of level up animation (ms)
    treatDropDuration: 1200,     // Duration of treat creation animation (ms)
    timerTickDuration: 1000,     // Timer update frequency (ms)
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
  
  // Sack System
  sack: {
    maxVisibleIngredients: 8,   // Maximum ingredients shown in sack
    completionThreshold: 5,     // Ingredients needed for recipe completion
    bonusXpPerCompletion: 25,   // Bonus XP for completing a recipe
  }
};

// Enhanced Level 1 ingredient system with small components
export const level1IngredientsDatabase = [
  // Basic Components (Always available at Level 1)
  { id: 'sugar', name: 'Sugar', type: 'sweetener', rarity: 'common', unlockLevel: 1, emoji: '🍬', color: '#ffffff' },
  { id: 'salt', name: 'Salt', type: 'seasoning', rarity: 'common', unlockLevel: 1, emoji: '🧂', color: '#f8f9fa' },
  
  // Level 1 Additional Components
  { id: 'honey', name: 'Honey', type: 'sweetener', rarity: 'common', unlockLevel: 1, emoji: '🍯', color: '#ffc107' },
  { id: 'pepper', name: 'Black Pepper', type: 'seasoning', rarity: 'common', unlockLevel: 1, emoji: '🌶️', color: '#343a40' },
  { id: 'vanilla', name: 'Vanilla', type: 'flavor', rarity: 'common', unlockLevel: 1, emoji: '🤍', color: '#f8f9fa' },
  { id: 'cinnamon', name: 'Cinnamon', type: 'spice', rarity: 'common', unlockLevel: 1, emoji: '🤎', color: '#8b4513' },
  
  // Rotating ingredients (appear randomly to keep gameplay fresh)
  { id: 'paprika', name: 'Paprika', type: 'spice', rarity: 'common', unlockLevel: 1, emoji: '🌶️', color: '#dc3545' },
  { id: 'garlic', name: 'Garlic Powder', type: 'seasoning', rarity: 'common', unlockLevel: 1, emoji: '🧄', color: '#f8f9fa' },
  { id: 'lemon', name: 'Lemon Zest', type: 'citrus', rarity: 'common', unlockLevel: 1, emoji: '🍋', color: '#fff3cd' },
  { id: 'mint', name: 'Mint Leaves', type: 'herb', rarity: 'common', unlockLevel: 1, emoji: '🌿', color: '#28a745' },
];

// Main ingredients (these remain constant and are the base of all treats)
export const mainIngredientsDatabase = [
  { id: 'chicken', name: 'Chicken', type: 'protein', rarity: 'common', emoji: '🍗', color: '#ffeaa7' },
  { id: 'beef', name: 'Beef', type: 'protein', rarity: 'common', emoji: '🥩', color: '#e17055' },
  { id: 'fish', name: 'Fish', type: 'protein', rarity: 'common', emoji: '🐟', color: '#74b9ff' },
  { id: 'cheese', name: 'Cheese', type: 'dairy', rarity: 'common', emoji: '🧀', color: '#fdcb6e' },
];

// Treat naming system based on ingredient combinations
export const treatCombinations = {
  // Sugar combinations
  'sugar+salt': { name: 'Sweet & Salty Surprise', rarity: 'uncommon', description: 'A perfect balance of flavors!' },
  'sugar+honey': { name: 'Double Sweet Delight', rarity: 'common', description: 'Twice the sweetness, twice the love!' },
  'sugar+vanilla': { name: 'Vanilla Sugar Puff', rarity: 'common', description: 'Classic comfort treat!' },
  'sugar+cinnamon': { name: 'Cinnamon Sugar Roll', rarity: 'uncommon', description: 'Warm and cozy goodness!' },
  'sugar+lemon': { name: 'Lemon Sugar Drop', rarity: 'common', description: 'Tangy and sweet perfection!' },
  'sugar+mint': { name: 'Minty Fresh Sweet', rarity: 'uncommon', description: 'Cool and refreshing!' },
  
  // Salt combinations
  'salt+pepper': { name: 'Classic Salt & Pepper', rarity: 'common', description: 'The timeless duo!' },
  'salt+garlic': { name: 'Savory Garlic Salt', rarity: 'common', description: 'Bold and flavorful!' },
  'salt+paprika': { name: 'Smoky Paprika Salt', rarity: 'uncommon', description: 'Rich and smoky taste!' },
  'salt+lemon': { name: 'Zesty Lemon Salt', rarity: 'common', description: 'Bright and tangy!' },
  
  // Honey combinations
  'honey+vanilla': { name: 'Vanilla Honey Swirl', rarity: 'common', description: 'Natural sweetness enhanced!' },
  'honey+cinnamon': { name: 'Honey Cinnamon Twist', rarity: 'uncommon', description: 'Warm spiced honey goodness!' },
  'honey+mint': { name: 'Honey Mint Refresher', rarity: 'uncommon', description: 'Sweet with a cool finish!' },
  'honey+lemon': { name: 'Honey Lemon Zinger', rarity: 'common', description: 'Bright and naturally sweet!' },
  
  // Other interesting combinations
  'vanilla+cinnamon': { name: 'Vanilla Cinnamon Warmth', rarity: 'common', description: 'Cozy bakery vibes!' },
  'pepper+garlic': { name: 'Spicy Garlic Kick', rarity: 'uncommon', description: 'Bold and intense!' },
  'paprika+garlic': { name: 'Smoky Garlic Blend', rarity: 'uncommon', description: 'Deep, complex flavors!' },
  'mint+lemon': { name: 'Citrus Mint Cooler', rarity: 'common', description: 'Fresh and invigorating!' },
  'cinnamon+mint': { name: 'Spiced Mint Fusion', rarity: 'rare', description: 'Unexpected but delightful!' },
  
  // Rare three-ingredient combinations (when players get creative)
  'sugar+cinnamon+vanilla': { name: 'Baker\'s Dream Treat', rarity: 'rare', description: 'Like fresh cookies from the oven!' },
  'honey+lemon+mint': { name: 'Garden Fresh Honey', rarity: 'rare', description: 'Natural harmony in every bite!' },
  'salt+pepper+garlic': { name: 'Ultimate Savory Blend', rarity: 'rare', description: 'The holy trinity of flavor!' },
};

// Function to generate random available ingredients for Level 1 (keeps gameplay fresh)
export const getRandomLevel1Ingredients = (count = 4) => {
  // Always include sugar and salt as base
  const baseIngredients = level1IngredientsDatabase.filter(ing => ['sugar', 'salt'].includes(ing.id));
  
  // Randomly select additional ingredients
  const otherIngredients = level1IngredientsDatabase.filter(ing => !['sugar', 'salt'].includes(ing.id));
  const shuffled = otherIngredients.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count - 2);
  
  return [...baseIngredients, ...selected];
};

// Function to create treat name from ingredient combination
export const createTreatName = (ingredients, mainIngredient) => {
  // Sort ingredients to ensure consistent naming
  const sortedIngredients = ingredients.map(ing => ing.id).sort();
  const combinationKey = sortedIngredients.join('+');
  
  // Look for exact combination
  if (treatCombinations[combinationKey]) {
    const combo = treatCombinations[combinationKey];
    return {
      name: `${mainIngredient.name} ${combo.name}`,
      rarity: combo.rarity,
      description: combo.description,
      ingredients: ingredients.map(ing => ing.name),
      mainIngredient: mainIngredient.name
    };
  }
  
  // Fallback naming for unknown combinations
  const ingredientNames = ingredients.map(ing => ing.name).join(' & ');
  return {
    name: `${mainIngredient.name} ${ingredientNames} Treat`,
    rarity: 'common',
    description: 'A unique custom creation!',
    ingredients: ingredients.map(ing => ing.name),
    mainIngredient: mainIngredient.name
  };
};

// Function to calculate XP based on combination rarity
export const calculateTreatXP = (treatRarity, level = 1) => {
  const baseXP = gameConfig.xp.baseXpPerCombo;
  const rarityMultipliers = {
    common: 1.0,
    uncommon: 1.5,
    rare: 2.0,
    epic: 3.0,
    legendary: 5.0
  };
  
  const multiplier = rarityMultipliers[treatRarity] || 1.0;
  return Math.floor(baseXP * multiplier * level);
};

// Get all ingredients available at a specific level
export const getAvailableIngredients = (level) => {
  if (level === 1) {
    return getRandomLevel1Ingredients(6); // 6 ingredients available at level 1
  }
  
  // For future levels, return more ingredients
  return level1IngredientsDatabase.filter(ing => ing.unlockLevel <= level);
};

// Timer utility functions
export const formatTimeRemaining = (milliseconds) => {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};

export const isTimerComplete = (startTime, duration) => {
  return Date.now() - startTime >= duration;
};

// Compatibility functions for old GameContext
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
  const rarityMultiplier = gameConfig.ingredients?.rarityMultiplier?.[rarity] || 1.0;
  
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