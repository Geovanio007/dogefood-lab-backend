"""
Spin Wheel Feature Tests
Tests the new 'Spin the Wheel' feature:
- GET /api/spin-wheel/status/{address} - returns can_spin, prizes array, hours_remaining
- POST /api/spin-wheel/spin - executes spin, returns prize with prize_index, applies reward
- 24h cooldown enforcement (429 on second spin)
- Points prizes update player points
- Extra lives prizes update player extra_treats_balance
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Using fresh test address for spin tests (as per agent context)
TEST_PLAYER_ADDRESS = "test_spin_agent"


class TestSpinWheelStatus:
    """Tests for GET /api/spin-wheel/status/{address}"""
    
    def test_spin_wheel_status_new_user(self):
        """Fresh user should be able to spin (can_spin=True)"""
        # Use a unique address to ensure no prior spins
        unique_address = f"test_spin_fresh_{int(time.time())}"
        
        response = requests.get(f"{BASE_URL}/api/spin-wheel/status/{unique_address}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "can_spin" in data, "Missing can_spin field"
        assert "prizes" in data, "Missing prizes field"
        assert "hours_remaining" in data, "Missing hours_remaining field"
        assert "cooldown_hours" in data, "Missing cooldown_hours field"
        
        # New user should be able to spin
        assert data["can_spin"] is True, f"New user should be able to spin, got can_spin={data['can_spin']}"
        assert data["hours_remaining"] == 0, f"New user should have 0 hours remaining, got {data['hours_remaining']}"
        
        # Verify prizes array structure
        assert isinstance(data["prizes"], list), "prizes should be a list"
        assert len(data["prizes"]) > 0, "prizes array should not be empty"
        
        # Each prize should have required fields
        for prize in data["prizes"]:
            assert "id" in prize, "Prize missing id"
            assert "label" in prize, "Prize missing label"
            assert "color" in prize, "Prize missing color"
            assert "emoji" in prize, "Prize missing emoji"
        
        print(f"PASS: Spin wheel status for new user - can_spin={data['can_spin']}, {len(data['prizes'])} prizes")
    
    def test_spin_wheel_prizes_count(self):
        """Verify wheel has 9 prize segments as per spec"""
        response = requests.get(f"{BASE_URL}/api/spin-wheel/status/{TEST_PLAYER_ADDRESS}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Per the spec: 9 colored segments
        assert len(data["prizes"]) == 9, f"Expected 9 prizes (segments), got {len(data['prizes'])}"
        
        # Verify prize types exist: points (100/150/200/300/500), 2 lives, 4 lives, mythic, 2x
        prize_labels = [p["label"] for p in data["prizes"]]
        
        expected_prizes = [
            "100 Points", "150 Points", "200 Points", "300 Points", "500 Points",
            "2 Extra Lives", "4 Extra Lives", "Mythic Ingredient", "2x Next Treat"
        ]
        
        for expected in expected_prizes:
            assert expected in prize_labels, f"Missing expected prize: {expected}"
        
        print(f"PASS: All 9 expected prizes found: {prize_labels}")


class TestSpinWheelSpin:
    """Tests for POST /api/spin-wheel/spin"""
    
    def test_spin_wheel_execute_spin(self):
        """Execute a spin and verify response structure"""
        # Use unique address to ensure fresh spin
        unique_address = f"test_spin_exec_{int(time.time())}"
        
        response = requests.post(
            f"{BASE_URL}/api/spin-wheel/spin",
            json={"player_address": unique_address}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "prize" in data, "Missing prize field"
        assert "prize_index" in data, "Missing prize_index field"
        assert "reward_applied" in data, "Missing reward_applied field"
        assert "reward_details" in data, "Missing reward_details field"
        assert "next_spin_at" in data, "Missing next_spin_at field"
        assert "message" in data, "Missing message field"
        
        # Verify prize structure
        prize = data["prize"]
        assert "id" in prize, "Prize missing id"
        assert "label" in prize, "Prize missing label"
        assert "type" in prize, "Prize missing type"
        assert "value" in prize, "Prize missing value"
        assert "color" in prize, "Prize missing color"
        assert "emoji" in prize, "Prize missing emoji"
        
        # prize_index should be 0-8 for 9 prizes
        assert 0 <= data["prize_index"] <= 8, f"prize_index {data['prize_index']} out of range"
        
        # Reward should be applied
        assert data["reward_applied"] is True, "Reward should be applied"
        
        print(f"PASS: Spin executed - won '{prize['label']}' (index {data['prize_index']})")
    
    def test_spin_wheel_missing_address(self):
        """Spin without player_address should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/spin-wheel/spin",
            json={}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("PASS: Spin without address returns 400")


class TestSpinWheelCooldown:
    """Tests for 24h cooldown enforcement"""
    
    def test_spin_wheel_24h_cooldown(self):
        """Second spin within 24h should return 429"""
        # Use unique address for this test
        unique_address = f"test_cooldown_{int(time.time())}"
        
        # First spin should succeed
        response1 = requests.post(
            f"{BASE_URL}/api/spin-wheel/spin",
            json={"player_address": unique_address}
        )
        assert response1.status_code == 200, f"First spin failed: {response1.text}"
        print(f"First spin succeeded for {unique_address}")
        
        # Small delay
        time.sleep(0.5)
        
        # Second spin should be blocked with 429
        response2 = requests.post(
            f"{BASE_URL}/api/spin-wheel/spin",
            json={"player_address": unique_address}
        )
        
        assert response2.status_code == 429, f"Expected 429 for cooldown, got {response2.status_code}: {response2.text}"
        
        # Verify error response structure
        data = response2.json()
        if isinstance(data.get("detail"), dict):
            detail = data["detail"]
            assert "message" in detail or "hours_remaining" in detail, "Cooldown error should include details"
        
        print(f"PASS: Second spin blocked with 429 (cooldown enforced)")
    
    def test_status_shows_cooldown_after_spin(self):
        """After spinning, status should show can_spin=False and hours_remaining > 0"""
        unique_address = f"test_status_cooldown_{int(time.time())}"
        
        # Check status before spin
        status_before = requests.get(f"{BASE_URL}/api/spin-wheel/status/{unique_address}")
        assert status_before.status_code == 200
        assert status_before.json()["can_spin"] is True, "Should be able to spin initially"
        
        # Execute spin
        spin_response = requests.post(
            f"{BASE_URL}/api/spin-wheel/spin",
            json={"player_address": unique_address}
        )
        assert spin_response.status_code == 200
        
        # Check status after spin
        status_after = requests.get(f"{BASE_URL}/api/spin-wheel/status/{unique_address}")
        assert status_after.status_code == 200
        data = status_after.json()
        
        assert data["can_spin"] is False, "Should NOT be able to spin after spinning"
        assert data["hours_remaining"] > 0, f"hours_remaining should be > 0, got {data['hours_remaining']}"
        assert data["hours_remaining"] <= 24, f"hours_remaining should be <= 24, got {data['hours_remaining']}"
        assert data["next_spin_at"] is not None, "next_spin_at should be set"
        
        print(f"PASS: Status after spin - can_spin=False, hours_remaining={data['hours_remaining']:.1f}")


class TestSpinWheelRewards:
    """Tests for reward application"""
    
    def test_points_reward_updates_player(self):
        """Points prize should update player's points balance"""
        # This test may require multiple spins to get a points prize
        # We'll verify the player endpoint to check points were applied
        unique_address = f"test_points_reward_{int(time.time())}"
        
        # First create/ensure player exists
        player_response = requests.post(
            f"{BASE_URL}/api/player",
            json={"address": unique_address, "is_nft_holder": False}
        )
        # 200 = created, or player already exists
        assert player_response.status_code == 200, f"Failed to create player: {player_response.text}"
        
        initial_points = player_response.json().get("points", 0)
        
        # Execute spin
        spin_response = requests.post(
            f"{BASE_URL}/api/spin-wheel/spin",
            json={"player_address": unique_address}
        )
        assert spin_response.status_code == 200
        
        spin_data = spin_response.json()
        prize_type = spin_data["prize"]["type"]
        prize_value = spin_data["prize"]["value"]
        
        # Get player data after spin
        player_after = requests.get(f"{BASE_URL}/api/player/{unique_address}")
        
        if prize_type == "points":
            # If won points, verify they were added
            assert player_after.status_code == 200
            new_points = player_after.json().get("points", 0)
            expected_points = initial_points + prize_value
            assert new_points >= expected_points, f"Points not applied: expected >= {expected_points}, got {new_points}"
            print(f"PASS: Points reward applied - {initial_points} -> {new_points} (+{prize_value})")
        elif prize_type == "extra_lives":
            # If won extra lives, verify extra_treats_balance
            assert player_after.status_code == 200
            extra_balance = player_after.json().get("extra_treats_balance", 0)
            assert extra_balance >= prize_value, f"Extra lives not applied: expected >= {prize_value}, got {extra_balance}"
            print(f"PASS: Extra lives reward applied - extra_treats_balance={extra_balance}")
        else:
            print(f"PASS: Won {prize_type} prize (value={prize_value}) - buff-type reward")


class TestRegressionChecks:
    """Regression tests for existing endpoints"""
    
    def test_auto_mixer_subscription_still_works(self):
        """Auto-mixer subscription endpoint should still work (no regression)"""
        response = requests.get(f"{BASE_URL}/api/auto-mixer/subscription/test_regression")
        
        # 200 OK (even for non-existent subscription)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should have subscription field (can be None)
        assert "subscription" in data, "Missing subscription field"
        print(f"PASS: Auto-mixer subscription endpoint working - subscription={data.get('subscription') is not None}")
    
    def test_treat_creation_still_works(self):
        """Treat creation endpoint should still work (no regression)"""
        # Just verify the endpoint exists and accepts requests
        unique_address = f"test_treat_regression_{int(time.time())}"
        
        # First create player with character selected
        player_resp = requests.post(
            f"{BASE_URL}/api/player",
            json={"address": unique_address, "is_nft_holder": False}
        )
        assert player_resp.status_code == 200, f"Failed to create player: {player_resp.text}"
        
        # Select character (required for treat creation)
        requests.post(
            f"{BASE_URL}/api/player/{unique_address}/select-character?character_id=luna"
        )
        
        # Try to create treat (minimum 2 ingredients required)
        response = requests.post(
            f"{BASE_URL}/api/treats/enhanced",
            json={
                "creator_address": unique_address,
                "ingredients": ["ING001", "ING002"],  # Need 2+ ingredients
                "player_level": 1
            }
        )
        
        # Should either succeed (200), return rate limit (429), or validation error (400)
        # 500 would indicate a regression bug
        assert response.status_code in [200, 429, 400], f"Unexpected status: {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "treat" in data or "outcome" in data, "Response should include treat data"
            print("PASS: Treat creation endpoint working - treat created")
        elif response.status_code == 429:
            print("PASS: Treat creation endpoint working - rate limited (expected)")
        else:
            print(f"PASS: Treat creation endpoint working - validation: {response.json().get('detail', 'unknown')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
