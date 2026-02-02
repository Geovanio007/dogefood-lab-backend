"""
Enhanced Treat Game Engine
Implements comprehensive game mechanics including level-based timers, rarity calculations,
ingredient combinations, and server-side randomization for the DogeFood Lab game.

RARITY SYSTEM:
| Rarity    | Probability | Timer Duration | Points Reward | Experience |
|-----------|-------------|----------------|---------------|------------|
| Common    | 45%         | 1-2 hours      | 10-20 points  | 5-10 XP    |
| Uncommon  | 30%         | 2-4 hours      | 25-40 points  | 15-25 XP   |
| Rare      | 15%         | 4-6 hours      | 50-80 points  | 30-50 XP   |
| Epic      | 7%          | 6-8 hours      | 100-150 pts   | 60-100 XP  |
| Legendary | 2.5%        | 8-12 hours     | 200-300 pts   | 120-200 XP |
| Mythic    | 0.5%        | 12-24 hours    | 500-1000 pts  | 250-500 XP |
"""

import random
import hashlib
import hmac
import time
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from enum import Enum


class TreatRarity(Enum):
    COMMON = "Common"
    UNCOMMON = "Uncommon"
    RARE = "Rare" 
    EPIC = "Epic"
    LEGENDARY = "Legendary"
    MYTHIC = "Mythic"


# Rarity configuration based on the game system
RARITY_CONFIG = {
    TreatRarity.COMMON: {
        "probability": 45.0,
        "timer_min_hours": 1.0,
        "timer_max_hours": 2.0,
        "points_min": 10,
        "points_max": 20,
        "xp_min": 5,
        "xp_max": 10,
        "color": "#9CA3AF",  # Gray
        "emoji": "⚪"
    },
    TreatRarity.UNCOMMON: {
        "probability": 30.0,
        "timer_min_hours": 2.0,
        "timer_max_hours": 4.0,
        "points_min": 25,
        "points_max": 40,
        "xp_min": 15,
        "xp_max": 25,
        "color": "#22C55E",  # Green
        "emoji": "🟢"
    },
    TreatRarity.RARE: {
        "probability": 15.0,
        "timer_min_hours": 4.0,
        "timer_max_hours": 6.0,
        "points_min": 50,
        "points_max": 80,
        "xp_min": 30,
        "xp_max": 50,
        "color": "#3B82F6",  # Blue
        "emoji": "🔵"
    },
    TreatRarity.EPIC: {
        "probability": 7.0,
        "timer_min_hours": 6.0,
        "timer_max_hours": 8.0,
        "points_min": 100,
        "points_max": 150,
        "xp_min": 60,
        "xp_max": 100,
        "color": "#A855F7",  # Purple
        "emoji": "🟣"
    },
    TreatRarity.LEGENDARY: {
        "probability": 2.5,
        "timer_min_hours": 8.0,
        "timer_max_hours": 12.0,
        "points_min": 200,
        "points_max": 300,
        "xp_min": 120,
        "xp_max": 200,
        "color": "#F59E0B",  # Gold/Orange
        "emoji": "🟡"
    },
    TreatRarity.MYTHIC: {
        "probability": 0.5,
        "timer_min_hours": 12.0,
        "timer_max_hours": 24.0,
        "points_min": 500,
        "points_max": 1000,
        "xp_min": 250,
        "xp_max": 500,
        "color": "#EF4444",  # Red
        "emoji": "🔴"
    }
}


class TreatGameEngine:
    def __init__(self, secret_key: str = None):
        """
        Initialize the game engine with secure randomization
        
        Args:
            secret_key: Secret key for secure random generation (should be from environment)
        """
        self.secret_key = secret_key or "default_secret_for_development_only"
        
        # Rarity order from most rare to least rare
        self.rarity_order = [
            TreatRarity.MYTHIC,
            TreatRarity.LEGENDARY,
            TreatRarity.EPIC,
            TreatRarity.RARE,
            TreatRarity.UNCOMMON,
            TreatRarity.COMMON
        ]
        
        # Minimum ingredients required for each rarity tier
        self.rarity_requirements = {
            TreatRarity.COMMON: 2,
            TreatRarity.UNCOMMON: 2,
            TreatRarity.RARE: 3,
            TreatRarity.EPIC: 4,
            TreatRarity.LEGENDARY: 5,
            TreatRarity.MYTHIC: 5
        }
        
        # Season duration in months
        self.season_duration_months = 3
        
    def generate_secure_random(self, player_address: str, treat_data: Dict, timestamp: int = None) -> float:
        """
        Generate secure, deterministic random number for consistency across players
        
        Args:
            player_address: Player's wallet address
            treat_data: Treat creation data for seed
            timestamp: Optional timestamp for additional entropy
            
        Returns:
            Random float between 0.0 and 1.0
        """
        if timestamp is None:
            timestamp = int(time.time() * 1000)  # Use milliseconds for more entropy
            
        # Create deterministic seed from player data
        seed_string = f"{player_address}:{treat_data}:{timestamp}:{self.secret_key}"
        seed_bytes = seed_string.encode('utf-8')
        
        # Use HMAC-SHA256 for cryptographically secure randomness
        hmac_hash = hmac.new(
            self.secret_key.encode('utf-8'),
            seed_bytes,
            hashlib.sha256
        ).hexdigest()
        
        # Convert hash to float between 0 and 1
        hash_int = int(hmac_hash[:16], 16)  # Use first 16 hex chars for more precision
        return hash_int / 0xFFFFFFFFFFFFFFFF
    
    def calculate_treat_rarity(self, ingredients: List[str], player_level: int, 
                             player_address: str, timestamp: int = None,
                             rare_chance_bonus: float = 0.0) -> TreatRarity:
        """
        Calculate treat rarity based on probability system
        
        Probabilities (base):
        - Common: 45%
        - Uncommon: 30%
        - Rare: 15%
        - Epic: 7%
        - Legendary: 2.5%
        - Mythic: 0.5%
        
        Args:
            ingredients: List of ingredient IDs used
            player_level: Player's current level
            player_address: Player's wallet address for secure randomization
            timestamp: Optional timestamp for deterministic results
            rare_chance_bonus: Bonus percentage for rare+ treats (Rex character = 0.15)
            
        Returns:
            TreatRarity enum value
        """
        num_ingredients = len(ingredients)
        
        # Reject if less than 2 ingredients
        if num_ingredients < 2:
            raise ValueError("Minimum 2 ingredients required for treat creation")
        
        # Determine allowed rarities based on ingredient count
        allowed_rarities = []
        for rarity in self.rarity_order:
            if num_ingredients >= self.rarity_requirements[rarity]:
                allowed_rarities.append(rarity)
        
        if not allowed_rarities:
            allowed_rarities = [TreatRarity.COMMON]  # Fallback
        
        # Generate secure random number
        random_value = self.generate_secure_random(
            player_address, 
            {"ingredients": sorted(ingredients), "level": player_level},
            timestamp
        )
        
        # Convert to percentage (0-100)
        roll = random_value * 100
        
        # Apply Rex's rare chance bonus - increases chance for Rare, Epic, Legendary, Mythic
        # By reducing the roll value, higher rarities become more likely
        if rare_chance_bonus > 0:
            # Apply bonus to make rare+ more likely (reduce the roll for better outcomes)
            bonus_applied = roll * (1 - rare_chance_bonus)
            roll = bonus_applied
        
        # Check rarities in order of rarity (highest first)
        cumulative_chance = 0
        for rarity in self.rarity_order:
            if rarity in allowed_rarities:
                cumulative_chance += RARITY_CONFIG[rarity]["probability"]
                if roll <= cumulative_chance:
                    return rarity
        
        # Fallback to common
        return TreatRarity.COMMON
    
    def calculate_timer_duration(self, rarity: TreatRarity, player_address: str, timestamp: int = None) -> int:
        """
        Calculate timer duration based on rarity with randomization within range
        
        Args:
            rarity: The treat rarity
            player_address: For randomization
            timestamp: Optional timestamp
            
        Returns:
            Timer duration in seconds
        """
        config = RARITY_CONFIG[rarity]
        min_hours = config["timer_min_hours"]
        max_hours = config["timer_max_hours"]
        
        # Generate random value within range
        random_value = self.generate_secure_random(
            player_address + "_timer",
            {"rarity": rarity.value},
            timestamp
        )
        
        # Calculate hours within range
        hours = min_hours + (random_value * (max_hours - min_hours))
        
        return int(hours * 3600)  # Convert to seconds
    
    def calculate_rewards(self, rarity: TreatRarity, player_address: str, timestamp: int = None) -> Dict:
        """
        Calculate points and XP rewards based on rarity
        
        Args:
            rarity: The treat rarity
            player_address: For randomization
            timestamp: Optional timestamp
            
        Returns:
            Dictionary with points and xp rewards
        """
        config = RARITY_CONFIG[rarity]
        
        # Generate random values for points and XP
        points_random = self.generate_secure_random(
            player_address + "_points",
            {"rarity": rarity.value},
            timestamp
        )
        xp_random = self.generate_secure_random(
            player_address + "_xp",
            {"rarity": rarity.value},
            timestamp
        )
        
        # Calculate rewards within ranges
        points = int(config["points_min"] + (points_random * (config["points_max"] - config["points_min"])))
        xp = int(config["xp_min"] + (xp_random * (config["xp_max"] - config["xp_min"])))
        
        return {
            "points": points,
            "xp": xp,
            "points_range": f"{config['points_min']}-{config['points_max']}",
            "xp_range": f"{config['xp_min']}-{config['xp_max']}"
        }
    
    def check_secret_combo_bonus(self, ingredients: List[str]) -> Dict:
        """
        Check if ingredient combination matches secret combos for bonus odds
        
        Args:
            ingredients: List of ingredient IDs
            
        Returns:
            Dictionary with bonus information
        """
        # Sort ingredients for consistent checking
        sorted_ingredients = sorted([ing.lower() for ing in ingredients])
        combo_key = "+".join(sorted_ingredients)
        
        # Secret combo definitions (stored server-side for security)
        secret_combos = {
            # High-value combos (+10% legendary/mythic chance)
            "chocolate+honey+milk+strawberry": {
                "name": "Ultimate Sweet Harmony",
                "bonus_mythic": 5,
                "bonus_legendary": 10,
                "bonus_epic": 5,
                "description": "The perfect dessert combination!"
            },
            "bacon+cheese+chicken+garlic": {
                "name": "Savory Master Blend", 
                "bonus_mythic": 5,
                "bonus_legendary": 10,
                "bonus_epic": 5,
                "description": "Ultimate protein and flavor combo!"
            },
            "chili_flakes+honey+peanut_butter+rainbow_sprinkles": {
                "name": "Sweet Fire Surprise",
                "bonus_mythic": 3,
                "bonus_legendary": 8,
                "bonus_epic": 7,
                "description": "Unexpected but amazing!"
            },
            
            # Medium combos (+5% legendary chance)
            "chocolate+milk+vanilla": {
                "name": "Classic Milkshake",
                "bonus_mythic": 2,
                "bonus_legendary": 5,
                "bonus_epic": 3,
                "description": "Timeless favorite!"
            },
            "banana+honey+peanut_butter": {
                "name": "Monkey's Dream",
                "bonus_mythic": 2,
                "bonus_legendary": 5,
                "bonus_epic": 3,
                "description": "Natural energy boost!"
            },
            
            # Fun combos (+3% bonus)
            "cookie_crumbs+milk": {
                "name": "Cookie Dunk Special",
                "bonus_mythic": 1,
                "bonus_legendary": 3,
                "bonus_epic": 2,
                "description": "Just like childhood!"
            }
        }
        
        combo = secret_combos.get(combo_key, {})
        return {
            "is_secret_combo": bool(combo),
            "combo_name": combo.get("name", ""),
            "bonus_mythic": combo.get("bonus_mythic", 0),
            "bonus_legendary": combo.get("bonus_legendary", 0),
            "bonus_epic": combo.get("bonus_epic", 0),
            "description": combo.get("description", "")
        }
    
    def calculate_treat_outcome(self, ingredients: List[str], player_level: int,
                              player_address: str, timestamp: int = None,
                              rare_chance_bonus: float = 0.0) -> Dict:
        """
        Complete treat outcome calculation including rarity, rewards, and metadata
        
        Args:
            ingredients: List of ingredient IDs
            player_level: Player's current level
            player_address: Player's wallet address
            timestamp: Optional timestamp for deterministic results
            rare_chance_bonus: Bonus percentage for rare+ treats (Rex character = 0.15)
            
        Returns:
            Dictionary with complete treat outcome data
        """
        # Validate minimum ingredients
        if len(ingredients) < 2:
            raise ValueError("Minimum 2 ingredients required")
        
        if timestamp is None:
            timestamp = int(time.time() * 1000)
        
        # Check for secret combo bonuses
        combo_bonus = self.check_secret_combo_bonus(ingredients)
        
        # Calculate base rarity with character bonus (Rex)
        base_rarity = self.calculate_treat_rarity(
            ingredients, player_level, player_address, timestamp, rare_chance_bonus
        )
        
        # Apply combo bonuses (if any)
        final_rarity = base_rarity
        if combo_bonus["is_secret_combo"]:
            # Re-roll with bonus chances for secret combos
            bonus_random = self.generate_secure_random(
                player_address + "_bonus",
                {"ingredients": sorted(ingredients), "level": player_level, "combo": True},
                timestamp
            )
            bonus_roll = bonus_random * 100
            
            # Apply mythic bonus
            if (final_rarity != TreatRarity.MYTHIC and 
                bonus_roll <= combo_bonus["bonus_mythic"]):
                final_rarity = TreatRarity.MYTHIC
            # Apply legendary bonus
            elif (final_rarity not in [TreatRarity.MYTHIC, TreatRarity.LEGENDARY] and 
                bonus_roll <= combo_bonus["bonus_legendary"]):
                final_rarity = TreatRarity.LEGENDARY
            # Apply epic bonus
            elif (final_rarity not in [TreatRarity.MYTHIC, TreatRarity.LEGENDARY, TreatRarity.EPIC] and
                  bonus_roll <= combo_bonus["bonus_epic"]):
                final_rarity = TreatRarity.EPIC
        
        # Calculate timer duration based on rarity
        timer_duration = self.calculate_timer_duration(final_rarity, player_address, timestamp)
        
        # Calculate rewards based on rarity
        rewards = self.calculate_rewards(final_rarity, player_address, timestamp)
        
        # Get rarity config for additional metadata
        rarity_config = RARITY_CONFIG[final_rarity]
        
        # Generate treat metadata
        return {
            "rarity": final_rarity.value,
            "rex_bonus_applied": rare_chance_bonus > 0,
            "rarity_emoji": rarity_config["emoji"],
            "rarity_color": rarity_config["color"],
            "ingredients_used": ingredients,
            "ingredient_count": len(ingredients),
            "player_level": player_level,
            "timer_duration_seconds": timer_duration,
            "timer_duration_hours": round(timer_duration / 3600, 2),
            "points_reward": rewards["points"],
            "xp_reward": rewards["xp"],
            "points_range": rewards["points_range"],
            "xp_range": rewards["xp_range"],
            "secret_combo": combo_bonus,
            "created_at": timestamp // 1000,  # Convert back to seconds
            "ready_at": (timestamp // 1000) + timer_duration,
            "season_id": self.get_current_season_id()
        }
    
    def get_current_season_id(self) -> int:
        """
        Calculate current season ID based on 3-month cycles
        
        Returns:
            Current season ID (starting from 1)
        """
        # For Season 1 offchain testing, always return Season 1
        return 1
    
    def get_season_info(self, season_id: int = None) -> Dict:
        """
        Get information about a specific season or current season
        
        Args:
            season_id: Optional season ID (defaults to current)
            
        Returns:
            Dictionary with season information
        """
        if season_id is None:
            season_id = self.get_current_season_id()
        
        # Calculate season start and end dates
        start_date = datetime(2024, 1, 1) + timedelta(
            days=(season_id - 1) * 90  # Approximately 3 months = 90 days
        )
        end_date = start_date + timedelta(days=90)
        
        return {
            "season_id": season_id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "duration_months": self.season_duration_months,
            "is_current": season_id == self.get_current_season_id()
        }
    
    def validate_treat_creation(self, ingredients: List[str], player_level: int) -> Dict:
        """
        Validate if treat creation is allowed with given parameters
        
        Args:
            ingredients: List of ingredient IDs
            player_level: Player's current level
            
        Returns:
            Validation result dictionary
        """
        errors = []
        warnings = []
        
        # Check minimum ingredients
        if len(ingredients) < 2:
            errors.append("Minimum 2 ingredients required for treat creation")
        
        # Check maximum ingredients (reasonable limit)
        if len(ingredients) > 10:
            warnings.append("Using many ingredients increases complexity but may not guarantee better outcomes")
        
        # Check for duplicate ingredients
        if len(ingredients) != len(set(ingredients)):
            errors.append("Duplicate ingredients are not allowed")
        
        # Check level constraints
        if player_level < 1:
            errors.append("Invalid player level")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "can_get_mythic": len(ingredients) >= self.rarity_requirements[TreatRarity.MYTHIC],
            "can_get_legendary": len(ingredients) >= self.rarity_requirements[TreatRarity.LEGENDARY],
            "can_get_epic": len(ingredients) >= self.rarity_requirements[TreatRarity.EPIC],
            "can_get_rare": len(ingredients) >= self.rarity_requirements[TreatRarity.RARE]
        }
    
    def get_rarity_info(self) -> Dict:
        """
        Get complete rarity system information for display
        
        Returns:
            Dictionary with all rarity configurations
        """
        rarity_info = {}
        for rarity in self.rarity_order:
            config = RARITY_CONFIG[rarity]
            rarity_info[rarity.value] = {
                "probability": f"{config['probability']}%",
                "timer_range": f"{config['timer_min_hours']}-{config['timer_max_hours']} hours",
                "points_range": f"{config['points_min']}-{config['points_max']} points",
                "xp_range": f"{config['xp_min']}-{config['xp_max']} XP",
                "color": config["color"],
                "emoji": config["emoji"],
                "min_ingredients": self.rarity_requirements[rarity]
            }
        return rarity_info


# Export RARITY_CONFIG for use in other modules
def get_rarity_config():
    return RARITY_CONFIG


# Example usage and testing functions
def test_game_engine():
    """Test the game engine functionality"""
    engine = TreatGameEngine("test_secret_key_123")
    
    # Test rarity distribution
    print("Testing Rarity Distribution (1000 rolls):")
    rarity_counts = {r.value: 0 for r in TreatRarity}
    
    for i in range(1000):
        ingredients = ["chicken", "rice", "vegetables", "honey", "milk"]  # 5 ingredients
        rarity = engine.calculate_treat_rarity(
            ingredients, 10, f"0x{i:040x}", i * 1000
        )
        rarity_counts[rarity.value] += 1
    
    for rarity, count in rarity_counts.items():
        print(f"  {rarity}: {count/10:.1f}%")
    
    # Test complete treat outcome
    print("\nComplete Treat Outcome Example:")
    outcome = engine.calculate_treat_outcome(
        ["chocolate", "honey", "milk", "strawberry"], 
        15, 
        "0x1234567890123456789012345678901234567890"
    )
    print(f"  Rarity: {outcome['rarity']} {outcome['rarity_emoji']}")
    print(f"  Timer: {outcome['timer_duration_hours']} hours")
    print(f"  Points: {outcome['points_reward']} ({outcome['points_range']})")
    print(f"  XP: {outcome['xp_reward']} ({outcome['xp_range']})")
    
    # Test rarity info
    print("\nRarity System Info:")
    rarity_info = engine.get_rarity_info()
    for rarity, info in rarity_info.items():
        print(f"  {info['emoji']} {rarity}: {info['probability']} chance, {info['timer_range']}, {info['points_range']}")


if __name__ == "__main__":
    test_game_engine()
