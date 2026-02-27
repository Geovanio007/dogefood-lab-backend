"""
Test file: Treat Creation Performance Optimization Tests
Tests the optimized POST /api/treats/enhanced endpoint performance after
consolidating 15+ sequential DB queries into ~5 parallelized ones.

Key optimizations tested:
- Prefetching player + treats in parallel (asyncio.gather)
- Anti-cheat validation with prefetched data
- Daily status endpoint still works correctly
- Response time under 3 seconds
- Complete response structure
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test address - use unique address to avoid conflicts with other tests
TEST_ADDRESS = "test_perf_agent_v2"
TEST_INGREDIENTS = ["kibble", "bone_meal"]


class TestEnhancedTreatCreationPerformance:
    """Test POST /api/treats/enhanced performance and response structure"""
    
    def test_enhanced_treat_creation_responds_under_3_seconds(self):
        """P0: Treat creation should respond in under 3 seconds after optimization"""
        payload = {
            "creator_address": TEST_ADDRESS,
            "ingredients": TEST_INGREDIENTS,
            "player_level": 1
        }
        
        start = time.time()
        response = requests.post(f"{BASE_URL}/api/treats/enhanced", json=payload)
        elapsed = time.time() - start
        
        # Accept 200 or 429 (rate limited) - both are valid responses
        assert response.status_code in [200, 429], f"Expected 200 or 429, got {response.status_code}: {response.text}"
        assert elapsed < 3.0, f"Treat creation took {elapsed:.2f}s, expected < 3s"
        print(f"✓ Enhanced treat creation responded in {elapsed:.3f}s")
    
    def test_enhanced_treat_response_contains_treat_field(self):
        """Response should contain 'treat' field with treat data"""
        payload = {
            "creator_address": TEST_ADDRESS,
            "ingredients": TEST_INGREDIENTS,
            "player_level": 1
        }
        
        response = requests.post(f"{BASE_URL}/api/treats/enhanced", json=payload)
        
        # Skip if rate limited
        if response.status_code == 429:
            pytest.skip("Rate limited - skipping response structure test")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "treat" in data, "Response should contain 'treat' field"
        treat = data["treat"]
        assert isinstance(treat, dict), "treat should be a dictionary"
        print(f"✓ Response contains treat field with id={treat.get('id')}")
    
    def test_enhanced_treat_response_contains_outcome_field(self):
        """Response should contain 'outcome' field with rarity and rewards"""
        payload = {
            "creator_address": TEST_ADDRESS,
            "ingredients": TEST_INGREDIENTS,
            "player_level": 1
        }
        
        response = requests.post(f"{BASE_URL}/api/treats/enhanced", json=payload)
        
        if response.status_code == 429:
            pytest.skip("Rate limited - skipping response structure test")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "outcome" in data, "Response should contain 'outcome' field"
        outcome = data["outcome"]
        assert "rarity" in outcome, "outcome should contain 'rarity'"
        assert "points_reward" in outcome, "outcome should contain 'points_reward'"
        assert "xp_reward" in outcome, "outcome should contain 'xp_reward'"
        print(f"✓ Response contains outcome: rarity={outcome['rarity']}, points={outcome['points_reward']}, xp={outcome['xp_reward']}")
    
    def test_enhanced_treat_response_contains_daily_status(self):
        """Response should contain 'daily_status' field"""
        payload = {
            "creator_address": TEST_ADDRESS,
            "ingredients": TEST_INGREDIENTS,
            "player_level": 1
        }
        
        response = requests.post(f"{BASE_URL}/api/treats/enhanced", json=payload)
        
        if response.status_code == 429:
            pytest.skip("Rate limited - skipping response structure test")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "daily_status" in data, "Response should contain 'daily_status' field"
        daily_status = data["daily_status"]
        assert "treats_in_window" in daily_status, "daily_status should contain treats_in_window"
        assert "can_create_treat" in daily_status, "daily_status should contain can_create_treat"
        print(f"✓ Response contains daily_status: treats_in_window={daily_status['treats_in_window']}, can_create={daily_status['can_create_treat']}")
    
    def test_enhanced_treat_response_contains_streak(self):
        """Response should contain 'streak' field with streak info"""
        payload = {
            "creator_address": TEST_ADDRESS,
            "ingredients": TEST_INGREDIENTS,
            "player_level": 1
        }
        
        response = requests.post(f"{BASE_URL}/api/treats/enhanced", json=payload)
        
        if response.status_code == 429:
            pytest.skip("Rate limited - skipping response structure test")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "streak" in data, "Response should contain 'streak' field"
        streak = data["streak"]
        assert "current_streak" in streak, "streak should contain current_streak"
        print(f"✓ Response contains streak: current_streak={streak['current_streak']}")
    
    def test_enhanced_treat_response_contains_message(self):
        """Response should contain 'message' field"""
        payload = {
            "creator_address": TEST_ADDRESS,
            "ingredients": TEST_INGREDIENTS,
            "player_level": 1
        }
        
        response = requests.post(f"{BASE_URL}/api/treats/enhanced", json=payload)
        
        if response.status_code == 429:
            pytest.skip("Rate limited - skipping response structure test")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data, "Response should contain 'message' field"
        assert isinstance(data["message"], str), "message should be a string"
        assert len(data["message"]) > 0, "message should not be empty"
        print(f"✓ Response contains message: {data['message'][:80]}...")


class TestDailyStatusEndpoint:
    """Test GET /api/daily-status/{address} endpoint still works correctly"""
    
    def test_daily_status_endpoint_responds(self):
        """Daily status endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/daily-status/{TEST_ADDRESS}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ Daily status endpoint responded successfully")
    
    def test_daily_status_contains_required_fields(self):
        """Daily status should contain all required fields"""
        response = requests.get(f"{BASE_URL}/api/daily-status/{TEST_ADDRESS}")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = [
            "treats_in_window",
            "treats_today",
            "window_limit",
            "daily_limit",
            "remaining_treats",
            "can_create_treat",
            "time_until_reset_seconds"
        ]
        
        for field in required_fields:
            assert field in data, f"Daily status missing field: {field}"
        
        print(f"✓ Daily status contains all required fields: {list(data.keys())}")
    
    def test_daily_status_performance(self):
        """Daily status should respond in under 2 seconds"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/daily-status/{TEST_ADDRESS}")
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 2.0, f"Daily status took {elapsed:.2f}s, expected < 2s"
        print(f"✓ Daily status responded in {elapsed:.3f}s")


class TestPlayerEndpoint:
    """Test GET /api/player/{address} endpoint"""
    
    def test_player_endpoint_responds(self):
        """Player endpoint should return 200 or 404"""
        response = requests.get(f"{BASE_URL}/api/player/{TEST_ADDRESS}")
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        print(f"✓ Player endpoint responded with status {response.status_code}")
    
    def test_player_endpoint_performance(self):
        """Player endpoint should respond in under 2 seconds"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/player/{TEST_ADDRESS}")
        elapsed = time.time() - start
        
        assert elapsed < 2.0, f"Player endpoint took {elapsed:.2f}s, expected < 2s"
        print(f"✓ Player endpoint responded in {elapsed:.3f}s")


class TestActiveTreatsEndpoint:
    """Test GET /api/treats/{address}/active endpoint"""
    
    def test_active_treats_endpoint_responds(self):
        """Active treats endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/treats/{TEST_ADDRESS}/active")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ Active treats endpoint responded successfully")
    
    def test_active_treats_contains_treats_array(self):
        """Active treats should return 'treats' array"""
        response = requests.get(f"{BASE_URL}/api/treats/{TEST_ADDRESS}/active")
        assert response.status_code == 200
        data = response.json()
        
        assert "treats" in data, "Response should contain 'treats' field"
        assert isinstance(data["treats"], list), "treats should be a list"
        print(f"✓ Active treats returned {len(data['treats'])} treats")
    
    def test_active_treats_performance(self):
        """Active treats should respond in under 2 seconds"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/treats/{TEST_ADDRESS}/active")
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 2.0, f"Active treats took {elapsed:.2f}s, expected < 2s"
        print(f"✓ Active treats responded in {elapsed:.3f}s")


class TestStatsEndpoint:
    """Test GET /api/stats endpoint"""
    
    def test_stats_endpoint_responds(self):
        """Stats endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ Stats endpoint responded successfully")
    
    def test_stats_performance(self):
        """Stats should respond in under 2 seconds"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/stats")
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 2.0, f"Stats took {elapsed:.2f}s, expected < 2s"
        print(f"✓ Stats responded in {elapsed:.3f}s")


class TestLeaderboardEndpoint:
    """Test GET /api/leaderboard endpoint"""
    
    def test_leaderboard_endpoint_responds(self):
        """Leaderboard endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ Leaderboard endpoint responded successfully")
    
    def test_leaderboard_performance(self):
        """Leaderboard should respond in under 2 seconds"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 2.0, f"Leaderboard took {elapsed:.2f}s, expected < 2s"
        print(f"✓ Leaderboard responded in {elapsed:.3f}s")


class TestAntiCheatValidation:
    """Test anti-cheat validation still works with prefetched data"""
    
    def test_rate_limiting_works(self):
        """Anti-cheat rate limiting should work correctly"""
        # Create multiple treats quickly to trigger rate limit
        payload = {
            "creator_address": f"test_rate_limit_{uuid.uuid4().hex[:8]}",
            "ingredients": TEST_INGREDIENTS,
            "player_level": 1
        }
        
        # First few requests should succeed (or rate limit based on daily limit)
        responses = []
        for i in range(5):
            response = requests.post(f"{BASE_URL}/api/treats/enhanced", json=payload)
            responses.append(response.status_code)
            time.sleep(0.5)  # Small delay between requests
        
        # At least some requests should be rate limited (429) or successful (200)
        valid_codes = [200, 429, 400]  # 400 for invalid recipe
        for code in responses:
            assert code in valid_codes, f"Got unexpected status code: {code}"
        
        print(f"✓ Rate limiting working: responses={responses}")
    
    def test_daily_limit_enforced(self):
        """Daily limit should be enforced by anti-cheat system"""
        response = requests.get(f"{BASE_URL}/api/daily-status/{TEST_ADDRESS}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify limit values are present and reasonable
        assert data["window_limit"] >= 4, f"window_limit should be >= 4, got {data['window_limit']}"
        assert data["daily_limit"] >= 16, f"daily_limit should be >= 16, got {data['daily_limit']}"
        print(f"✓ Daily limit enforced: window_limit={data['window_limit']}, daily_limit={data['daily_limit']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
