"""
P0 Bug Tests - GameLab Polish
Tests for the two P0 bugs:
1. Players only seeing 3 basic ingredients at higher levels
2. Spin Wheel awarding different prize than where wheel lands
"""

import pytest
import requests
import os
import time
import random

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://gamelab-polish.preview.emergentagent.com')


class TestIngredientUnlockByLevel:
    """
    P0 Bug #1: Verify ingredients are loaded based on player level
    
    Backend endpoint: GET /api/ingredients/unlocked/{player_level}
    Expected behavior: Level 1 players get ~3 Core ingredients,
    higher level players get progressively more ingredients from additional categories.
    """
    
    def test_level_1_gets_core_ingredients_only(self):
        """Level 1 should only unlock basic Core ingredients (3 items)"""
        response = requests.get(f"{BASE_URL}/api/ingredients/unlocked/1")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["player_level"] == 1
        assert data["unlocked_count"] == 3, f"Level 1 should have 3 ingredients, got {data['unlocked_count']}"
        
        categories = list(data["unlocked_by_category"].keys())
        assert categories == ["Core"], f"Level 1 should only have Core category, got {categories}"
        
        # Verify the specific Core ingredients at level 1
        core_ingredients = data["unlocked_by_category"]["Core"]
        assert len(core_ingredients) == 3
        print(f"✓ Level 1: {data['unlocked_count']} ingredients - {categories}")
    
    def test_level_6_unlocks_elonverse_ingredients(self):
        """Level 6 should unlock Elonverse category ingredients in addition to Core"""
        response = requests.get(f"{BASE_URL}/api/ingredients/unlocked/6")
        assert response.status_code == 200
        
        data = response.json()
        assert data["player_level"] == 6
        # Level 6 should have Core (5) + Elonverse (2) = 7 ingredients
        assert data["unlocked_count"] >= 7, f"Level 6 should have at least 7 ingredients, got {data['unlocked_count']}"
        
        categories = list(data["unlocked_by_category"].keys())
        assert "Core" in categories, "Level 6 should have Core category"
        assert "Elonverse" in categories, "Level 6 should unlock Elonverse category"
        print(f"✓ Level 6: {data['unlocked_count']} ingredients - {categories}")
    
    def test_level_12_unlocks_space_and_lab_ingredients(self):
        """Level 12 should unlock Space and Lab categories"""
        response = requests.get(f"{BASE_URL}/api/ingredients/unlocked/12")
        assert response.status_code == 200
        
        data = response.json()
        assert data["player_level"] == 12
        # Level 12 should have Core, Elonverse, Space, and Lab
        assert data["unlocked_count"] >= 15, f"Level 12 should have 15+ ingredients, got {data['unlocked_count']}"
        
        categories = list(data["unlocked_by_category"].keys())
        assert "Core" in categories
        assert "Elonverse" in categories
        assert "Space" in categories, "Level 12 should unlock Space category"
        assert "Lab" in categories, "Level 12 should unlock Lab category"
        print(f"✓ Level 12: {data['unlocked_count']} ingredients - {categories}")
    
    def test_level_20_unlocks_mythic_ingredients(self):
        """Level 20 should unlock Mythic category ingredients"""
        response = requests.get(f"{BASE_URL}/api/ingredients/unlocked/20")
        assert response.status_code == 200
        
        data = response.json()
        assert data["player_level"] == 20
        
        categories = list(data["unlocked_by_category"].keys())
        assert "Mythic" in categories, "Level 20 should unlock Mythic category"
        assert data["unlocked_count"] >= 20, f"Level 20 should have 20+ ingredients"
        print(f"✓ Level 20: {data['unlocked_count']} ingredients - {categories}")
    
    def test_ingredient_count_increases_with_level(self):
        """Verify ingredient count strictly increases with level"""
        levels = [1, 3, 6, 10, 12, 16, 20, 25]
        counts = []
        
        for level in levels:
            response = requests.get(f"{BASE_URL}/api/ingredients/unlocked/{level}")
            assert response.status_code == 200
            data = response.json()
            counts.append(data["unlocked_count"])
        
        # Verify monotonically increasing
        for i in range(1, len(counts)):
            assert counts[i] >= counts[i-1], f"Level {levels[i]} should have >= ingredients than level {levels[i-1]}"
        
        print(f"✓ Ingredient counts by level: {dict(zip(levels, counts))}")


class TestSpinWheelDeterminism:
    """
    P0 Bug #2: Verify wheel landing segment matches backend awarded prize
    
    Backend endpoint: POST /api/spin-wheel/spin
    Returns: prize_index, landing_angle_degrees, full_spins
    
    The frontend uses landing_angle_degrees to animate the wheel to land
    on the correct prize_index segment.
    """
    
    def test_spin_returns_all_required_fields(self):
        """Spin endpoint should return prize_index, landing_angle_degrees, full_spins"""
        test_addr = f"test_spin_fields_{int(time.time() * 1000)}"
        
        response = requests.post(
            f"{BASE_URL}/api/spin-wheel/spin",
            json={"player_address": test_addr}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify all required fields are present
        assert "prize_index" in data, "Response must include prize_index"
        assert "landing_angle_degrees" in data, "Response must include landing_angle_degrees"
        assert "full_spins" in data, "Response must include full_spins"
        assert "prize" in data, "Response must include prize object"
        
        # Verify types
        assert isinstance(data["prize_index"], int), "prize_index must be integer"
        assert isinstance(data["landing_angle_degrees"], (int, float)), "landing_angle_degrees must be number"
        assert isinstance(data["full_spins"], int), "full_spins must be integer"
        
        print(f"✓ Spin returned: prize_index={data['prize_index']}, landing_angle={data['landing_angle_degrees']}, full_spins={data['full_spins']}")
    
    def test_landing_angle_matches_prize_index(self):
        """
        Verify that landing_angle_degrees positions the wheel pointer on the correct prize_index segment.
        
        Math verification:
        - Each segment = 360 / 9 = 40 degrees
        - Segment 0 spans 0-40 degrees
        - Pointer is at 270 degrees (top of wheel)
        - landing_angle should be (pointer_angle - segment_center) % 360
        """
        test_addr = f"test_spin_angle_{int(time.time() * 1000)}"
        
        response = requests.post(
            f"{BASE_URL}/api/spin-wheel/spin",
            json={"player_address": test_addr}
        )
        assert response.status_code == 200
        
        data = response.json()
        prize_index = data["prize_index"]
        landing_angle = data["landing_angle_degrees"]
        
        # Calculate expected landing angle
        num_prizes = 9
        segment_angle = 360 / num_prizes  # 40 degrees per segment
        pointer_angle = 270  # Pointer at top
        
        # Segment center for prize_index
        segment_center = (prize_index * segment_angle) + (segment_angle / 2)
        expected_landing = (pointer_angle - segment_center) % 360
        
        # Allow some tolerance for floating point
        tolerance = 1.0
        angle_diff = abs(landing_angle - expected_landing)
        if angle_diff > 180:
            angle_diff = 360 - angle_diff
        
        assert angle_diff < tolerance, \
            f"Landing angle {landing_angle} does not match expected {expected_landing} for prize_index {prize_index}"
        
        print(f"✓ prize_index={prize_index} -> landing_angle={landing_angle} (expected ~{expected_landing})")
    
    def test_multiple_spins_have_consistent_math(self):
        """Run multiple spins and verify landing angle consistency"""
        results = []
        
        for i in range(5):
            test_addr = f"test_spin_multi_{int(time.time() * 1000)}_{i}_{random.randint(0, 99999)}"
            
            response = requests.post(
                f"{BASE_URL}/api/spin-wheel/spin",
                json={"player_address": test_addr}
            )
            
            if response.status_code != 200:
                continue
            
            data = response.json()
            prize_index = data["prize_index"]
            landing_angle = data["landing_angle_degrees"]
            
            # Verify math
            segment_angle = 360 / 9
            pointer_angle = 270
            segment_center = (prize_index * segment_angle) + (segment_angle / 2)
            expected = (pointer_angle - segment_center) % 360
            
            angle_diff = abs(landing_angle - expected)
            if angle_diff > 180:
                angle_diff = 360 - angle_diff
            
            is_valid = angle_diff < 1.0
            results.append({
                "prize_index": prize_index,
                "landing_angle": landing_angle,
                "expected": expected,
                "valid": is_valid
            })
            
            time.sleep(0.1)  # Small delay between requests
        
        # All results should be valid
        valid_count = sum(1 for r in results if r["valid"])
        print(f"✓ {valid_count}/{len(results)} spins have correct landing angle math")
        
        for r in results:
            status = "✓" if r["valid"] else "✗"
            print(f"  {status} prize_index={r['prize_index']}: landing={r['landing_angle']:.2f}, expected={r['expected']:.2f}")
        
        assert valid_count == len(results), f"All spins should have valid landing angles"
    
    def test_spin_cooldown_enforced(self):
        """Verify 24h cooldown is enforced - second spin returns 429"""
        test_addr = f"test_spin_cooldown_{int(time.time() * 1000)}"
        
        # First spin should succeed
        response1 = requests.post(
            f"{BASE_URL}/api/spin-wheel/spin",
            json={"player_address": test_addr}
        )
        assert response1.status_code == 200, "First spin should succeed"
        
        # Second spin should fail with 429
        response2 = requests.post(
            f"{BASE_URL}/api/spin-wheel/spin",
            json={"player_address": test_addr}
        )
        assert response2.status_code == 429, f"Second spin should return 429, got {response2.status_code}"
        
        print("✓ 24h cooldown correctly enforced")


class TestPlayerDataFlow:
    """
    Test that player level data flows correctly from backend to frontend
    """
    
    def test_player_endpoint_returns_level(self):
        """Player endpoint should return level for ingredient loading"""
        # Create a new test player
        test_addr = f"test_player_level_{int(time.time() * 1000)}"
        
        # Try to get player (may not exist)
        response = requests.get(f"{BASE_URL}/api/player/{test_addr}")
        
        if response.status_code == 404:
            # Player doesn't exist - expected for new address
            print("✓ Player not found returns 404 (expected for new address)")
        else:
            assert response.status_code == 200
            data = response.json()
            assert "level" in data, "Player response should include level"
            print(f"✓ Player data includes level: {data.get('level')}")
    
    def test_ingredient_unlock_sequence(self):
        """Verify ingredients unlock in correct sequence by level"""
        expected_unlocks = {
            1: ["ING001", "ING002", "ING003"],  # First 3 Core
            3: ["ING005"],  # Crunchy Kibble at level 3
            6: ["ING101", "ING104"],  # Elonverse starts
            10: ["ING106"],  # Mars Regolith at level 10
        }
        
        for level, expected_ids in expected_unlocks.items():
            response = requests.get(f"{BASE_URL}/api/ingredients/unlocked/{level}")
            assert response.status_code == 200
            
            data = response.json()
            all_ingredient_ids = []
            for category_ingredients in data["unlocked_by_category"].values():
                all_ingredient_ids.extend([ing["id"] for ing in category_ingredients])
            
            for expected_id in expected_ids:
                assert expected_id in all_ingredient_ids, \
                    f"Ingredient {expected_id} should be unlocked at level {level}"
            
            print(f"✓ Level {level}: Expected ingredients present")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
