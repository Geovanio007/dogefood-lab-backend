"""
Enhanced Treat Game Engine
Implements comprehensive game mechanics including level-based timers, rarity calculations,
ingredient combinations, and server-side randomization for the DogeFood Lab game.
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
    RARE = "Rare" 
    EPIC = "Epic"
    LEGENDARY = "Legendary"


class TreatGameEngine:
    def __init__(self, secret_key: str = None):
        """
        Initialize the game engine with secure randomization
        
        Args:
            secret_key: Secret key for secure random generation (should be from environment)
        """
        self.secret_key = secret_key or "default_secret_for_development_only"
        
        # Rarity probabilities (must sum to 100)
        self.rarity_probabilities = {
            TreatRarity.LEGENDARY: 10,  # 10% chance
            TreatRarity.EPIC: 20,       # 20% chance  
            TreatRarity.RARE: 30,       # 30% chance
            TreatRarity.COMMON: 40      # 40% chance
        }
        
        # Minimum ingredients required for each rarity
        self.rarity_requirements = {
            TreatRarity.COMMON: 2,
            TreatRarity.RARE: 3,
            TreatRarity.EPIC: 4,
            TreatRarity.LEGENDARY: 5
        }
        
        # Time progression formula parameters
        self.time_formula = {
            "base_time_hours": 1.0,          # 1 hour base
            "scaling_type": "exponential",    # or "linear" 
            "scaling_factor": 0.2,           # Growth rate
            "max_time_hours": 12.0           # Cap at 12 hours
        }
        
        # Season duration in months
        self.season_duration_months = 3
        
    def calculate_treat_timer(self, level: int) -> int:
        """
        Calculate treat preparation time based on level with exponential/linear growth
        
        Args:
            level: Player level (1-100+)
            
        Returns:
            Time in seconds
        """
        base_time = self.time_formula["base_time_hours"]
        scaling_factor = self.time_formula["scaling_factor"]
        max_time = self.time_formula["max_time_hours"]
        
        if self.time_formula["scaling_type"] == "exponential":
            # Exponential: time = base_time * (1 + scaling_factor) ^ (level - 1)
            time_hours = min(
                base_time * ((1 + scaling_factor) ** (level - 1)),
                max_time
            )
        else:  # linear
            # Linear: time = base_time + (level - 1) * scaling_factor
            time_hours = min(
                base_time + (level - 1) * scaling_factor,
                max_time
            )
            
        return int(time_hours * 3600)  # Convert to seconds
    
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
            timestamp = int(time.time())
            
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
        hash_int = int(hmac_hash[:8], 16)  # Use first 8 hex chars
        return hash_int / 0xFFFFFFFF
    
    def calculate_treat_rarity(self, ingredients: List[str], player_level: int, 
                             player_address: str, timestamp: int = None) -> TreatRarity:
        """
        Calculate treat rarity based on ingredients, with minimum requirements enforced
        
        Args:
            ingredients: List of ingredient IDs used
            player_level: Player's current level
            player_address: Player's wallet address for secure randomization
            timestamp: Optional timestamp for deterministic results
            
        Returns:
            TreatRarity enum value
        """
        num_ingredients = len(ingredients)
        
        # Reject if less than 2 ingredients
        if num_ingredients < 2:
            raise ValueError("Minimum 2 ingredients required for treat creation")
        
        # Determine allowed rarities based on ingredient count
        allowed_rarities = []
        for rarity, min_required in self.rarity_requirements.items():
            if num_ingredients >= min_required:
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
        
        # Check rarities in order of rarity (highest first)
        cumulative_chance = 0
        for rarity in [TreatRarity.LEGENDARY, TreatRarity.EPIC, TreatRarity.RARE, TreatRarity.COMMON]:
            if rarity in allowed_rarities:
                cumulative_chance += self.rarity_probabilities[rarity]
                if roll <= cumulative_chance:
                    return rarity
        
        # Fallback to common
        return TreatRarity.COMMON
    
    def check_secret_combo_bonus(self, ingredients: List[str]) -> Dict:
        """
        Check if ingredient combination matches secret combos for bonus odds
        
        Args:
            ingredients: List of ingredient IDs
            
        Returns:
            Dictionary with bonus information
        """
        # Sort ingredients for consistent checking
        sorted_ingredients = sorted(ingredients)
        combo_key = "+".join(sorted_ingredients)
        
        # Secret combo definitions (stored server-side for security)
        secret_combos = {
            # High-value combos (+10% legendary chance)
            "chocolate+honey+milk+strawberry": {
                "name": "Ultimate Sweet Harmony",
                "bonus_legendary": 10,
                "bonus_epic": 5,
                "description": "The perfect dessert combination!"
            },
            "bacon+cheese+chicken+garlic": {
                "name": "Savory Master Blend", 
                "bonus_legendary": 10,
                "bonus_epic": 5,
                "description": "Ultimate protein and flavor combo!"
            },
            "chili_flakes+honey+peanut_butter+rainbow_sprinkles": {
                "name": "Sweet Fire Surprise",
                "bonus_legendary": 8,
                "bonus_epic": 7,
                "description": "Unexpected but amazing!"
            },
            
            # Medium combos (+5% legendary chance)
            "chocolate+milk+vanilla": {
                "name": "Classic Milkshake",
                "bonus_legendary": 5,
                "bonus_epic": 3,
                "description": "Timeless favorite!"
            },
            "banana+honey+peanut_butter": {
                "name": "Monkey's Dream",
                "bonus_legendary": 5,
                "bonus_epic": 3,
                "description": "Natural energy boost!"
            },
            
            # Fun combos (+3% bonus)
            "cookie_crumbs+milk": {
                "name": "Cookie Dunk Special",
                "bonus_legendary": 3,
                "bonus_epic": 2,
                "description": "Just like childhood!"
            }
        }
        
        combo = secret_combos.get(combo_key, {})
        return {
            "is_secret_combo": bool(combo),
            "combo_name": combo.get("name", ""),
            "bonus_legendary": combo.get("bonus_legendary", 0),
            "bonus_epic": combo.get("bonus_epic", 0),
            "description": combo.get("description", "")
        }
    
    def calculate_treat_outcome(self, ingredients: List[str], player_level: int,
                              player_address: str, timestamp: int = None) -> Dict:
        """
        Complete treat outcome calculation including rarity, bonuses, and metadata
        
        Args:
            ingredients: List of ingredient IDs
            player_level: Player's current level
            player_address: Player's wallet address
            timestamp: Optional timestamp for deterministic results
            
        Returns:
            Dictionary with complete treat outcome data
        """
        # Validate minimum ingredients
        if len(ingredients) < 2:
            raise ValueError("Minimum 2 ingredients required")
        
        # Check for secret combo bonuses
        combo_bonus = self.check_secret_combo_bonus(ingredients)
        
        # Calculate base rarity
        base_rarity = self.calculate_treat_rarity(
            ingredients, player_level, player_address, timestamp
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
            
            # Apply legendary bonus
            if (final_rarity != TreatRarity.LEGENDARY and 
                bonus_roll <= combo_bonus["bonus_legendary"]):
                final_rarity = TreatRarity.LEGENDARY
            # Apply epic bonus
            elif (final_rarity not in [TreatRarity.LEGENDARY, TreatRarity.EPIC] and
                  bonus_roll <= combo_bonus["bonus_epic"]):
                final_rarity = TreatRarity.EPIC
        
        # Calculate timer duration
        timer_duration = self.calculate_treat_timer(player_level)
        
        # Generate treat metadata
        return {
            "rarity": final_rarity.value,
            "ingredients_used": ingredients,
            "ingredient_count": len(ingredients),
            "player_level": player_level,
            "timer_duration_seconds": timer_duration,
            "timer_duration_hours": round(timer_duration / 3600, 1),
            "secret_combo": combo_bonus,
            "created_at": timestamp or int(time.time()),
            "ready_at": (timestamp or int(time.time())) + timer_duration,
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
        
        # Original logic (commented out for testing)
        # # Use a fixed start date (e.g., January 1, 2024)
        # start_date = datetime(2024, 1, 1)
        # current_date = datetime.now()
        # 
        # # Calculate months elapsed
        # months_elapsed = (
        #     (current_date.year - start_date.year) * 12 + 
        #     current_date.month - start_date.month
        # )
        # 
        # # Season ID = (months // 3) + 1
        # return (months_elapsed // self.season_duration_months) + 1
    
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
            "can_get_legendary": len(ingredients) >= self.rarity_requirements[TreatRarity.LEGENDARY],
            "can_get_epic": len(ingredients) >= self.rarity_requirements[TreatRarity.EPIC],
            "can_get_rare": len(ingredients) >= self.rarity_requirements[TreatRarity.RARE]
        }


# Example usage and testing functions
def test_game_engine():
    """Test the game engine functionality"""
    engine = TreatGameEngine("test_secret_key_123")
    
    # Test timer progression
    print("Timer Progression:")
    for level in [1, 5, 10, 20, 30, 50]:
        timer_seconds = engine.calculate_treat_timer(level)
        hours = timer_seconds / 3600
        print(f"Level {level}: {hours:.1f} hours ({timer_seconds} seconds)")
    
    # Test rarity calculation
    print("\nRarity Testing:")
    test_ingredients = ["chocolate", "honey", "milk", "strawberry", "vanilla"]
    for i in range(2, 6):
        ingredients_subset = test_ingredients[:i]
        rarity = engine.calculate_treat_rarity(
            ingredients_subset, 10, "0x1234567890123456789012345678901234567890"
        )
        print(f"{i} ingredients {ingredients_subset}: {rarity.value}")
    
    # Test secret combos
    print("\nSecret Combo Testing:")
    secret_combo_ingredients = ["chocolate", "honey", "milk", "strawberry"]
    combo_result = engine.check_secret_combo_bonus(secret_combo_ingredients)
    print(f"Secret combo result: {combo_result}")
    
    # Test complete treat outcome
    print("\nComplete Treat Outcome:")
    outcome = engine.calculate_treat_outcome(
        secret_combo_ingredients, 15, "0x1234567890123456789012345678901234567890"
    )
    print(f"Final outcome: {outcome}")


if __name__ == "__main__":
    test_game_engine()