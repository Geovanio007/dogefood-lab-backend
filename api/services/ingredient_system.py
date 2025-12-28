"""
Enhanced Ingredient System
Manages 20+ unique ingredients, unlock levels, and ingredient combinations
for the DogeFood Lab game.
"""

from typing import Dict, List, Optional, Set
from enum import Enum
from dataclasses import dataclass


class IngredientType(Enum):
    PROTEIN = "protein"
    DAIRY = "dairy"
    SWEET = "sweet"
    SPICE = "spice"
    FRUIT = "fruit"
    VEGGIE = "veggie"
    SPECIAL = "special"
    FUNNY = "funny"  # For humorous ingredients like chili flakes


@dataclass
class Ingredient:
    id: str
    name: str
    emoji: str
    type: IngredientType
    unlock_level: int
    rarity: str = "common"  # common, rare, epic, legendary
    description: str = ""
    fun_fact: str = ""


class IngredientSystem:
    def __init__(self):
        """Initialize the ingredient system with all available ingredients"""
        self.ingredients = self._initialize_ingredients()
        self.ingredient_lookup = {ing.id: ing for ing in self.ingredients}
    
    def _initialize_ingredients(self) -> List[Ingredient]:
        """Define all 20+ unique ingredients with unlock progression"""
        return [
            # Level 1-5: Basic ingredients
            Ingredient("strawberry", "🍓 Strawberry", "🍓", IngredientType.FRUIT, 1,
                      description="Fresh and sweet berries", fun_fact="Dogs love the natural sweetness!"),
            
            Ingredient("chocolate", "🍫 Chocolate", "🍫", IngredientType.SWEET, 1,
                      description="Rich cocoa goodness", fun_fact="Use dog-safe carob instead of regular chocolate"),
            
            Ingredient("honey", "🍯 Honey", "🍯", IngredientType.SWEET, 1,
                      description="Natural golden sweetness", fun_fact="Nature's perfect energy source"),
            
            Ingredient("milk", "🥛 Milk", "🥛", IngredientType.DAIRY, 2,
                      description="Creamy dairy base", fun_fact="Use lactose-free for sensitive pups"),
            
            Ingredient("banana", "🍌 Banana", "🍌", IngredientType.FRUIT, 2,
                      description="Potassium-rich fruit", fun_fact="Great for active dogs!"),
            
            Ingredient("cookie_crumbs", "🍪 Cookie Crumbs", "🍪", IngredientType.SWEET, 3,
                      description="Crunchy treat bits", fun_fact="The secret to texture perfection"),
            
            Ingredient("peanut_butter", "🥜 Peanut Butter", "🥜", IngredientType.PROTEIN, 3,
                      description="Creamy nutty goodness", fun_fact="Most dogs' favorite ingredient!"),
            
            Ingredient("candy_dust", "🍬 Candy Dust", "🍬", IngredientType.SWEET, 4,
                      description="Sparkling sweet powder", fun_fact="Adds magical shimmer to treats"),
            
            Ingredient("rainbow_sprinkles", "🌈 Rainbow Sprinkles", "🌈", IngredientType.SPECIAL, 4,
                      description="Colorful fun topping", fun_fact="Makes every treat a celebration!"),
            
            Ingredient("chili_flakes", "🔥 Chili Flakes", "🔥", IngredientType.FUNNY, 5, "rare",
                      description="Surprising spicy kick", fun_fact="Some adventurous pups love the tingle!"),
            
            # Level 6-10: Intermediate ingredients
            Ingredient("chicken", "🍗 Chicken", "🍗", IngredientType.PROTEIN, 6,
                      description="Lean protein source", fun_fact="Classic dog favorite since forever"),
            
            Ingredient("cheese", "🧀 Cheese", "🧀", IngredientType.DAIRY, 6,
                      description="Rich and savory", fun_fact="Aged cheddar works best for treats"),
            
            Ingredient("beef", "🥩 Beef", "🥩", IngredientType.PROTEIN, 7, "rare",
                      description="Premium meat protein", fun_fact="High-quality beef makes gourmet treats"),
            
            Ingredient("salmon", "🐟 Salmon", "🐟", IngredientType.PROTEIN, 7, "rare",
                      description="Omega-3 rich fish", fun_fact="Great for shiny coats!"),
            
            Ingredient("bacon", "🥓 Bacon", "🥓", IngredientType.PROTEIN, 8, "rare",
                      description="Smoky indulgence", fun_fact="The ultimate high-value reward"),
            
            Ingredient("blueberry", "🫐 Blueberry", "🫐", IngredientType.FRUIT, 8,
                      description="Antioxidant powerhouse", fun_fact="Nature's superfood for dogs"),
            
            Ingredient("pumpkin", "🎃 Pumpkin", "🎃", IngredientType.VEGGIE, 9,
                      description="Fiber-rich squash", fun_fact="Great for digestive health"),
            
            Ingredient("coconut", "🥥 Coconut", "🥥", IngredientType.SPECIAL, 9, "rare",
                      description="Tropical goodness", fun_fact="Natural oils support coat health"),
            
            # Level 11-15: Advanced ingredients
            Ingredient("sweet_potato", "🍠 Sweet Potato", "🍠", IngredientType.VEGGIE, 11,
                      description="Nutritious root vegetable", fun_fact="Natural source of beta-carotene"),
            
            Ingredient("apple", "🍎 Apple", "🍎", IngredientType.FRUIT, 11,
                      description="Crisp and refreshing", fun_fact="Remove seeds - core only for dogs"),
            
            Ingredient("oats", "🌾 Oats", "🌾", IngredientType.SPECIAL, 12,
                      description="Heart-healthy grains", fun_fact="Slow-release energy for active dogs"),
            
            Ingredient("yogurt", "🥛 Yogurt", "🥛", IngredientType.DAIRY, 12,
                      description="Probiotic dairy", fun_fact="Supports digestive health"),
            
            Ingredient("carrot", "🥕 Carrot", "🥕", IngredientType.VEGGIE, 13,
                      description="Crunchy orange veggie", fun_fact="Great for dental health"),
            
            Ingredient("turkey", "🦃 Turkey", "🦃", IngredientType.PROTEIN, 13, "rare",
                      description="Lean holiday protein", fun_fact="Lower fat alternative to chicken"),
            
            # Level 16-20: Expert ingredients  
            Ingredient("quinoa", "🌱 Quinoa", "🌱", IngredientType.SPECIAL, 16, "epic",
                      description="Superfood grain", fun_fact="Complete protein source from plants"),
            
            Ingredient("duck", "🦆 Duck", "🦆", IngredientType.PROTEIN, 17, "epic",
                      description="Rich poultry protein", fun_fact="Hypoallergenic option for sensitive dogs"),
            
            Ingredient("spirulina", "💚 Spirulina", "💚", IngredientType.SPECIAL, 18, "epic",
                      description="Superfood algae", fun_fact="Packed with vitamins and minerals"),
            
            # Level 21+: Legendary ingredients
            Ingredient("truffle_oil", "🍄 Truffle Oil", "🍄", IngredientType.SPECIAL, 21, "legendary",
                      description="Gourmet fungus essence", fun_fact="The ultimate luxury ingredient"),
            
            Ingredient("wagyu_beef", "🥩 Wagyu Beef", "🥩", IngredientType.PROTEIN, 23, "legendary",
                      description="Premium marbled beef", fun_fact="The most exclusive protein available"),
            
            Ingredient("gold_flakes", "✨ Gold Flakes", "✨", IngredientType.SPECIAL, 25, "legendary",
                      description="Edible gold decoration", fun_fact="For treats worthy of royalty"),
        ]
    
    def get_ingredients_by_level(self, max_level: int) -> List[Ingredient]:
        """Get all ingredients unlocked at or below the specified level"""
        return [ing for ing in self.ingredients if ing.unlock_level <= max_level]
    
    def get_ingredients_by_rarity(self, rarity: str) -> List[Ingredient]:
        """Get all ingredients of a specific rarity"""
        return [ing for ing in self.ingredients if ing.rarity == rarity]
    
    def get_ingredient_by_id(self, ingredient_id: str) -> Optional[Ingredient]:
        """Get specific ingredient by ID"""
        return self.ingredient_lookup.get(ingredient_id)
    
    def get_ingredients_by_type(self, ingredient_type: IngredientType) -> List[Ingredient]:
        """Get all ingredients of a specific type"""
        return [ing for ing in self.ingredients if ing.type == ingredient_type]
    
    def get_new_unlocks_for_level(self, level: int) -> List[Ingredient]:
        """Get ingredients that are newly unlocked at a specific level"""
        return [ing for ing in self.ingredients if ing.unlock_level == level]
    
    def calculate_ingredient_variety_bonus(self, ingredient_ids: List[str]) -> Dict:
        """
        Calculate bonus based on ingredient variety (different types used)
        
        Args:
            ingredient_ids: List of ingredient IDs used in treat
            
        Returns:
            Dictionary with variety bonus information
        """
        ingredients = [self.get_ingredient_by_id(id) for id in ingredient_ids if self.get_ingredient_by_id(id)]
        
        # Count unique ingredient types
        types_used = set(ing.type for ing in ingredients)
        type_count = len(types_used)
        
        # Calculate variety bonus
        variety_bonus = {
            1: {"multiplier": 1.0, "description": "Single type"},
            2: {"multiplier": 1.1, "description": "Good variety"}, 
            3: {"multiplier": 1.2, "description": "Great variety"},
            4: {"multiplier": 1.3, "description": "Excellent variety"},
            5: {"multiplier": 1.5, "description": "Perfect harmony"},
            6: {"multiplier": 1.7, "description": "Master chef level"},
            7: {"multiplier": 2.0, "description": "Legendary variety"}
        }.get(type_count, {"multiplier": 2.0, "description": "Impossible variety"})
        
        return {
            "types_used": [t.value for t in types_used],
            "type_count": type_count,
            "variety_multiplier": variety_bonus["multiplier"],
            "variety_description": variety_bonus["description"],
            "ingredients": [{"id": ing.id, "name": ing.name, "type": ing.type.value} for ing in ingredients]
        }
    
    def get_ingredient_compatibility(self, ingredient_ids: List[str]) -> Dict:
        """
        Check ingredient compatibility and suggest improvements
        
        Args:
            ingredient_ids: List of ingredient IDs
            
        Returns:
            Compatibility analysis
        """
        ingredients = [self.get_ingredient_by_id(id) for id in ingredient_ids if self.get_ingredient_by_id(id)]
        
        # Analyze ingredient balance
        type_distribution = {}
        rarity_distribution = {}
        
        for ing in ingredients:
            type_distribution[ing.type.value] = type_distribution.get(ing.type.value, 0) + 1
            rarity_distribution[ing.rarity] = rarity_distribution.get(ing.rarity, 0) + 1
        
        # Check for balance
        suggestions = []
        
        # Too many of one type
        for type_name, count in type_distribution.items():
            if count > 3:
                suggestions.append(f"Consider reducing {type_name} ingredients for better balance")
        
        # Missing protein
        if IngredientType.PROTEIN.value not in type_distribution:
            suggestions.append("Add a protein ingredient for better nutritional balance")
        
        # All same rarity
        if len(rarity_distribution) == 1 and len(ingredients) > 2:
            suggestions.append("Mix different rarity ingredients for more interesting outcomes")
        
        return {
            "ingredient_count": len(ingredients),
            "type_distribution": type_distribution,
            "rarity_distribution": rarity_distribution,
            "balance_score": min(len(type_distribution) * 20, 100),  # Max 100 for 5+ types
            "suggestions": suggestions,
            "is_balanced": len(type_distribution) >= 2 and len(suggestions) <= 1
        }
    
    def get_random_ingredients_for_level(self, level: int, count: int = 8) -> List[Ingredient]:
        """
        Get a random selection of ingredients for a specific level (for variety in UI)
        
        Args:
            level: Player level
            count: Number of ingredients to return
            
        Returns:
            List of randomly selected ingredients
        """
        available = self.get_ingredients_by_level(level)
        
        if len(available) <= count:
            return available
        
        # Ensure we always include some basic ingredients
        basic_ingredients = [ing for ing in available if ing.unlock_level <= 3]
        random_basics = basic_ingredients[:min(3, len(basic_ingredients))]
        
        # Add random selection from remaining
        remaining = [ing for ing in available if ing not in random_basics]
        
        import random
        random_selection = random.sample(remaining, min(count - len(random_basics), len(remaining)))
        
        return random_basics + random_selection
    
    def export_ingredients_for_frontend(self, max_level: int) -> List[Dict]:
        """
        Export ingredients in format suitable for frontend consumption
        
        Args:
            max_level: Maximum level to include
            
        Returns:
            List of ingredient dictionaries
        """
        ingredients = self.get_ingredients_by_level(max_level)
        
        return [
            {
                "id": ing.id,
                "name": ing.name,
                "emoji": ing.emoji,
                "type": ing.type.value,
                "unlock_level": ing.unlock_level,
                "rarity": ing.rarity,
                "description": ing.description,
                "fun_fact": ing.fun_fact,
                "unlocked": ing.unlock_level <= max_level
            }
            for ing in ingredients
        ]
    
    def get_ingredient_stats(self) -> Dict:
        """Get overall ingredient system statistics"""
        total_ingredients = len(self.ingredients)
        
        by_rarity = {}
        by_type = {}
        by_level = {}
        
        for ing in self.ingredients:
            by_rarity[ing.rarity] = by_rarity.get(ing.rarity, 0) + 1
            by_type[ing.type.value] = by_type.get(ing.type.value, 0) + 1
            by_level[ing.unlock_level] = by_level.get(ing.unlock_level, 0) + 1
        
        return {
            "total_ingredients": total_ingredients,
            "rarity_distribution": by_rarity,
            "type_distribution": by_type,
            "level_distribution": by_level,
            "max_unlock_level": max(ing.unlock_level for ing in self.ingredients),
            "ingredient_types": [t.value for t in IngredientType]
        }


# Example usage and testing
def test_ingredient_system():
    """Test the ingredient system functionality"""
    system = IngredientSystem()
    
    print("Ingredient System Stats:")
    stats = system.get_ingredient_stats()
    print(f"Total ingredients: {stats['total_ingredients']}")
    print(f"Rarity distribution: {stats['rarity_distribution']}")
    print(f"Type distribution: {stats['type_distribution']}")
    
    print("\nLevel 1 ingredients:")
    level1_ingredients = system.get_ingredients_by_level(1)
    for ing in level1_ingredients:
        print(f"  {ing.emoji} {ing.name} ({ing.type.value})")
    
    print("\nLegendary ingredients:")
    legendary = system.get_ingredients_by_rarity("legendary")
    for ing in legendary:
        print(f"  {ing.emoji} {ing.name} (Level {ing.unlock_level})")
    
    print("\nVariety bonus test:")
    test_ingredients = ["strawberry", "chicken", "honey", "cheese", "chili_flakes"]
    variety = system.calculate_ingredient_variety_bonus(test_ingredients)
    print(f"  Variety multiplier: {variety['variety_multiplier']}x")
    print(f"  Description: {variety['variety_description']}")


if __name__ == "__main__":
    test_ingredient_system()