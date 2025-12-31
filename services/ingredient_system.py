"""
DogeFood Lab - Enhanced Ingredient System
Implements the complete ingredient catalog with categories, levels, and special effects
"""

from typing import Dict, List, Optional
from enum import Enum
from dataclasses import dataclass


class IngredientCategory(Enum):
    CORE = "Core"
    ELONVERSE = "Elonverse"
    SPACE = "Space"
    LAB = "Lab"
    MYTHIC = "Mythic"


class SpecialEffect(Enum):
    NONE = "None"
    XP_BOOST = "XP Boost"
    MINOR_XP_BOOST = "Minor XP Boost"
    RARITY_BOOST = "Rarity Boost"
    LEGENDARY_GATE = "Legendary Gate"
    TIMER_REDUCTION = "Timer Reduction"
    TIMER_INCREASE = "Timer Increase"
    VISUAL_EFFECT = "Visual Effect"
    VISUAL_GLOW = "Visual Glow"
    VISUAL_GLITCH = "Visual Glitch"
    POINTS_BOOST = "Points Boost"
    MYTHIC_GATE = "Mythic Gate"
    MUTATION_CHANCE = "Mutation Chance"
    RNG_BOOST = "RNG Boost"
    TIMER_RANDOMIZER = "Timer Randomizer"
    MYTHIC_REQUIRED = "Mythic Required"


@dataclass
class Ingredient:
    id: str
    name: str
    category: IngredientCategory
    rarity_weight: float
    description: str
    special_effect: SpecialEffect
    unlock_level: int
    emoji: str
    color: str


# Complete ingredient catalog
INGREDIENTS_CATALOG: Dict[str, Ingredient] = {
    # Core Ingredients (Level 1-5)
    "ING001": Ingredient("ING001", "Crunchy Kibble", IngredientCategory.CORE, 1.0, 
                        "Basic crunchy base ingredient", SpecialEffect.NONE, 1, "🦴", "#F59E0B"),
    "ING002": Ingredient("ING002", "Golden Bone Dust", IngredientCategory.CORE, 1.1,
                        "Premium mineral powder", SpecialEffect.XP_BOOST, 2, "✨", "#EAB308"),
    "ING003": Ingredient("ING003", "Meme Meat Cubes", IngredientCategory.CORE, 1.0,
                        "Protein-packed meme meat", SpecialEffect.NONE, 1, "🥩", "#DC2626"),
    "ING004": Ingredient("ING004", "Shiba Crunch Flakes", IngredientCategory.CORE, 1.0,
                        "Crispy shiba cereal flakes", SpecialEffect.NONE, 1, "🥣", "#F97316"),
    "ING005": Ingredient("ING005", "Woof Whey Powder", IngredientCategory.CORE, 1.05,
                        "Energy-enhancing powder", SpecialEffect.MINOR_XP_BOOST, 3, "💪", "#FBBF24"),
    
    # Elonverse Ingredients (Level 6-10)
    "ING101": Ingredient("ING101", "Rocket Fuel Syrup", IngredientCategory.ELONVERSE, 1.2,
                        "High-energy syrup inspired by rockets", SpecialEffect.RARITY_BOOST, 6, "🚀", "#3B82F6"),
    "ING102": Ingredient("ING102", "Neural Dust", IngredientCategory.ELONVERSE, 1.25,
                        "Experimental cognitive powder", SpecialEffect.XP_BOOST, 7, "🧠", "#8B5CF6"),
    "ING103": Ingredient("ING103", "Starship Alloy Shavings", IngredientCategory.ELONVERSE, 1.3,
                        "Ultra-rare metallic flakes", SpecialEffect.LEGENDARY_GATE, 9, "⚙️", "#6B7280"),
    "ING104": Ingredient("ING104", "Solar Charge Crystals", IngredientCategory.ELONVERSE, 1.15,
                        "Sun-powered crystals", SpecialEffect.TIMER_REDUCTION, 6, "☀️", "#FBBF24"),
    "ING105": Ingredient("ING105", "X-Signal Spice", IngredientCategory.ELONVERSE, 1.1,
                        "Trending meme spice", SpecialEffect.VISUAL_EFFECT, 8, "📡", "#06B6D4"),
    "ING106": Ingredient("ING106", "Mars Regolith Powder", IngredientCategory.ELONVERSE, 1.35,
                        "Red planetary soil", SpecialEffect.LEGENDARY_GATE, 10, "🔴", "#EF4444"),
    
    # Space Ingredients (Level 11-15)
    "ING201": Ingredient("ING201", "Moon Cheese", IngredientCategory.SPACE, 1.2,
                        "Lunar dairy delicacy", SpecialEffect.VISUAL_GLOW, 11, "🌙", "#E5E7EB"),
    "ING202": Ingredient("ING202", "Cosmic Ice Cubes", IngredientCategory.SPACE, 1.1,
                        "Frozen space particles", SpecialEffect.TIMER_INCREASE, 11, "🧊", "#67E8F9"),
    "ING203": Ingredient("ING203", "Asteroid Protein", IngredientCategory.SPACE, 1.25,
                        "Ancient protein matter", SpecialEffect.POINTS_BOOST, 12, "☄️", "#A78BFA"),
    "ING204": Ingredient("ING204", "Dark Matter Sprinkles", IngredientCategory.SPACE, 1.4,
                        "Unstable exotic matter", SpecialEffect.LEGENDARY_GATE, 14, "🌌", "#1E1B4B"),
    "ING205": Ingredient("ING205", "Plasma Sugar", IngredientCategory.SPACE, 1.15,
                        "Energy-rich sugar", SpecialEffect.XP_BOOST, 12, "⚡", "#F472B6"),
    "ING206": Ingredient("ING206", "Zero-G Gel", IngredientCategory.SPACE, 1.3,
                        "Weightless binding agent", SpecialEffect.MYTHIC_GATE, 15, "🫧", "#C4B5FD"),
    
    # Lab Ingredients (Level 11-15)
    "ING301": Ingredient("ING301", "Radioactive Carrots", IngredientCategory.LAB, 1.1,
                        "Mutated carrots from lab experiments", SpecialEffect.MUTATION_CHANCE, 11, "🥕", "#84CC16"),
    "ING302": Ingredient("ING302", "Quantum Sauce", IngredientCategory.LAB, 1.25,
                        "Probability-bending liquid", SpecialEffect.RNG_BOOST, 13, "🧪", "#22D3EE"),
    "ING303": Ingredient("ING303", "Time-Warp Yeast", IngredientCategory.LAB, 1.2,
                        "Fermentation across timelines", SpecialEffect.TIMER_RANDOMIZER, 12, "⏰", "#A855F7"),
    "ING304": Ingredient("ING304", "Glitch Spice", IngredientCategory.LAB, 1.15,
                        "Unstable digital seasoning", SpecialEffect.VISUAL_GLITCH, 14, "👾", "#10B981"),
    "ING305": Ingredient("ING305", "Nano Vitamins", IngredientCategory.LAB, 1.1,
                        "Microscopic nutrient boosters", SpecialEffect.XP_BOOST, 11, "💊", "#14B8A6"),
    
    # Mythic Ingredients (Level 16+)
    "ING401": Ingredient("ING401", "Doge Relic Fragment", IngredientCategory.MYTHIC, 2.0,
                        "Ancient doge artifact", SpecialEffect.MYTHIC_REQUIRED, 16, "🏺", "#FCD34D"),
    "ING402": Ingredient("ING402", "Genesis Biscuit", IngredientCategory.MYTHIC, 2.2,
                        "The first doge treat ever baked", SpecialEffect.MYTHIC_REQUIRED, 18, "🍪", "#FFD700"),
    "ING403": Ingredient("ING403", "Cosmic Shiba Hair", IngredientCategory.MYTHIC, 2.5,
                        "Ultra-rare cosmic fur", SpecialEffect.MYTHIC_REQUIRED, 20, "🐕", "#E879F9"),
    "ING404": Ingredient("ING404", "Singularity Syrup", IngredientCategory.MYTHIC, 3.0,
                        "Reality-bending syrup", SpecialEffect.MYTHIC_REQUIRED, 25, "🌀", "#F43F5E"),
}


# Category colors and styling
CATEGORY_STYLES = {
    IngredientCategory.CORE: {
        "color": "#F59E0B",
        "bg_gradient": "from-yellow-500/20 to-orange-500/20",
        "border": "border-yellow-500/50",
        "glow": "shadow-yellow-500/30",
        "name": "Core",
        "unlock_range": "Level 1-5"
    },
    IngredientCategory.ELONVERSE: {
        "color": "#3B82F6",
        "bg_gradient": "from-blue-500/20 to-cyan-500/20",
        "border": "border-blue-500/50",
        "glow": "shadow-blue-500/30",
        "name": "Elonverse",
        "unlock_range": "Level 6-10"
    },
    IngredientCategory.SPACE: {
        "color": "#8B5CF6",
        "bg_gradient": "from-purple-500/20 to-indigo-500/20",
        "border": "border-purple-500/50",
        "glow": "shadow-purple-500/30",
        "name": "Space",
        "unlock_range": "Level 11-15"
    },
    IngredientCategory.LAB: {
        "color": "#22C55E",
        "bg_gradient": "from-green-500/20 to-emerald-500/20",
        "border": "border-green-500/50",
        "glow": "shadow-green-500/30",
        "name": "Lab",
        "unlock_range": "Level 11-15"
    },
    IngredientCategory.MYTHIC: {
        "color": "#F59E0B",
        "bg_gradient": "from-yellow-500/20 via-pink-500/20 to-purple-500/20",
        "border": "border-yellow-400/70",
        "glow": "shadow-yellow-400/50",
        "name": "Mythic",
        "unlock_range": "Level 16+"
    }
}


class IngredientSystem:
    def __init__(self):
        self.ingredients = INGREDIENTS_CATALOG
        self.category_styles = CATEGORY_STYLES
    
    def get_ingredient(self, ingredient_id: str) -> Optional[Ingredient]:
        """Get ingredient by ID"""
        return self.ingredients.get(ingredient_id)
    
    def get_ingredients_by_category(self, category: IngredientCategory) -> List[Ingredient]:
        """Get all ingredients in a category"""
        return [ing for ing in self.ingredients.values() if ing.category == category]
    
    def get_unlocked_ingredients(self, player_level: int) -> List[Ingredient]:
        """Get all ingredients unlocked at a given level"""
        return [ing for ing in self.ingredients.values() if ing.unlock_level <= player_level]
    
    def get_locked_ingredients(self, player_level: int) -> List[Ingredient]:
        """Get all ingredients still locked at a given level"""
        return [ing for ing in self.ingredients.values() if ing.unlock_level > player_level]
    
    def get_ingredients_for_level_range(self, min_level: int, max_level: int) -> List[Ingredient]:
        """Get ingredients unlocked within a level range"""
        return [ing for ing in self.ingredients.values() 
                if min_level <= ing.unlock_level <= max_level]
    
    def calculate_rarity_modifier(self, ingredients: List[str]) -> float:
        """Calculate total rarity modifier from selected ingredients"""
        total_weight = 0.0
        for ing_id in ingredients:
            ing = self.get_ingredient(ing_id)
            if ing:
                total_weight += ing.rarity_weight
        return total_weight / len(ingredients) if ingredients else 1.0
    
    def get_special_effects(self, ingredients: List[str]) -> List[SpecialEffect]:
        """Get all special effects from selected ingredients"""
        effects = []
        for ing_id in ingredients:
            ing = self.get_ingredient(ing_id)
            if ing and ing.special_effect != SpecialEffect.NONE:
                effects.append(ing.special_effect)
        return effects
    
    def has_mythic_catalyst(self, ingredients: List[str]) -> bool:
        """Check if ingredients include a mythic catalyst"""
        for ing_id in ingredients:
            ing = self.get_ingredient(ing_id)
            if ing and ing.special_effect == SpecialEffect.MYTHIC_REQUIRED:
                return True
        return False
    
    def has_legendary_gate(self, ingredients: List[str]) -> bool:
        """Check if ingredients include a legendary gate ingredient"""
        for ing_id in ingredients:
            ing = self.get_ingredient(ing_id)
            if ing and ing.special_effect == SpecialEffect.LEGENDARY_GATE:
                return True
        return False
    
    def can_create_rarity(self, ingredients: List[str], target_rarity: str) -> bool:
        """Check if selected ingredients can create a specific rarity"""
        count = len(ingredients)
        has_mythic = self.has_mythic_catalyst(ingredients)
        
        rarity_requirements = {
            "Common": (1, False),
            "Uncommon": (2, False),
            "Rare": (3, False),
            "Epic": (4, False),
            "Legendary": (5, False),
            "Mythic": (5, True)
        }
        
        req_count, req_mythic = rarity_requirements.get(target_rarity, (1, False))
        
        if count < req_count:
            return False
        if req_mythic and not has_mythic:
            return False
        return True
    
    def get_all_ingredients_json(self) -> List[dict]:
        """Get all ingredients as JSON-serializable list"""
        return [
            {
                "id": ing.id,
                "name": ing.name,
                "category": ing.category.value,
                "rarity_weight": ing.rarity_weight,
                "description": ing.description,
                "special_effect": ing.special_effect.value,
                "unlock_level": ing.unlock_level,
                "emoji": ing.emoji,
                "color": ing.color
            }
            for ing in self.ingredients.values()
        ]
    
    def get_category_info(self) -> List[dict]:
        """Get category information as JSON"""
        return [
            {
                "category": cat.value,
                "color": style["color"],
                "bg_gradient": style["bg_gradient"],
                "border": style["border"],
                "glow": style["glow"],
                "name": style["name"],
                "unlock_range": style["unlock_range"]
            }
            for cat, style in self.category_styles.items()
        ]


# Recipe templates for suggested combinations
RECIPE_TEMPLATES = [
    {
        "id": "TREAT001",
        "name": "Crunchy Woof Bite",
        "rarity": "Common",
        "ingredients": ["ING001", "ING004"],
        "visual_effect": "None",
        "description": "A simple but satisfying treat"
    },
    {
        "id": "TREAT002", 
        "name": "Lunar Shiba Snack",
        "rarity": "Rare",
        "ingredients": ["ING001", "ING201", "ING205"],
        "visual_effect": "Glow",
        "description": "A moon-powered delicacy"
    },
    {
        "id": "TREAT003",
        "name": "Rocket Woof Supreme",
        "rarity": "Epic",
        "ingredients": ["ING003", "ING101", "ING104", "ING302"],
        "visual_effect": "Animated Flames",
        "description": "Fuel your inner rocket dog"
    },
    {
        "id": "TREAT004",
        "name": "Mars Alpha Biscuit",
        "rarity": "Legendary",
        "ingredients": ["ING103", "ING106", "ING204", "ING102", "ING002"],
        "visual_effect": "Hologram",
        "description": "The taste of Martian glory"
    },
    {
        "id": "TREAT005",
        "name": "Genesis Doge Relic",
        "rarity": "Mythic",
        "ingredients": ["ING402", "ING401", "ING403", "ING404", "ING206"],
        "visual_effect": "Unique Aura",
        "description": "The legendary first treat"
    }
]
