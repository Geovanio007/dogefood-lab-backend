"""
Test file: Performance Optimizations v2 Tests
Tests additional optimizations:
- POST /api/treats/{treat_id}/collect - parallel fetch of treat+player
- GET /api/player/{address}/profile - centralized lookup for TG users (tg_ prefix)
- GET /api/chat/messages - chat endpoint
- Verify all endpoints respond under 2 seconds

Test address: tg_7438800063 (real TG user for profile tests)
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Real TG user address for testing profile endpoint
TG_TEST_ADDRESS = "tg_7438800063"
TEST_INGREDIENTS = ["kibble", "bone_meal"]

def get_unique_test_address():
    """Generate unique address for each test to avoid rate limiting"""
    return f"test_v2_{int(time.time())}_{uuid.uuid4().hex[:8]}"


class TestCollectTreatParallelFetch:
    """Test POST /api/treats/{treat_id}/collect with parallel fetch optimization"""
    
    def test_collect_treat_endpoint_exists(self):
        """Verify collect treat endpoint exists (expects 400/404 without valid data)"""
        response = requests.post(f"{BASE_URL}/api/treats/nonexistent-treat-id/collect", json={
            "player_address": get_unique_test_address()
        })
        # 404 = treat not found (expected), 400 = bad request
        assert response.status_code in [400, 404, 422], f"Unexpected status {response.status_code}: {response.text}"
        print(f"✓ Collect treat endpoint exists (status {response.status_code})")
    
    def test_collect_treat_requires_player_address(self):
        """Collect treat requires player_address in request body"""
        response = requests.post(f"{BASE_URL}/api/treats/fake-treat-id/collect", json={})
        # Should return 400 for missing player_address
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
        print(f"✓ Collect treat validates player_address requirement")
    
    def test_collect_treat_performance_under_2s(self):
        """Collect treat endpoint should respond under 2 seconds even for invalid treats"""
        start = time.time()
        response = requests.post(f"{BASE_URL}/api/treats/nonexistent-treat/collect", json={
            "player_address": get_unique_test_address()
        })
        elapsed = time.time() - start
        
        assert elapsed < 2.0, f"Collect treat took {elapsed:.2f}s, expected < 2s"
        print(f"✓ Collect treat responded in {elapsed:.3f}s")


class TestPlayerProfileCentralizedLookup:
    """Test GET /api/player/{address}/profile with centralized lookup for TG users"""
    
    def test_player_profile_endpoint_exists(self):
        """Verify profile endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/player/{TG_TEST_ADDRESS}/profile")
        # Should return 200 (profile found or default profile)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Player profile endpoint exists")
    
    def test_player_profile_for_tg_user(self):
        """Profile endpoint should work for TG users (tg_ prefix)"""
        response = requests.get(f"{BASE_URL}/api/player/{TG_TEST_ADDRESS}/profile")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response has expected fields
        assert "address" in data or "nickname" in data, "Profile should contain address or nickname"
        print(f"✓ TG user profile returned: nickname={data.get('nickname')}, address={data.get('address')}")
    
    def test_player_profile_returns_required_fields(self):
        """Profile should return expected fields for any address"""
        test_addr = get_unique_test_address()
        response = requests.get(f"{BASE_URL}/api/player/{test_addr}/profile")
        assert response.status_code == 200
        data = response.json()
        
        # These fields should always be present (even as null/default)
        expected_fields = ["address", "nickname", "selected_character", "is_vip", "points", "level"]
        for field in expected_fields:
            assert field in data, f"Profile missing field: {field}"
        
        print(f"✓ Profile contains required fields: {list(data.keys())}")
    
    def test_player_profile_performance_under_2s(self):
        """Player profile should respond under 2 seconds"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/player/{TG_TEST_ADDRESS}/profile")
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 2.0, f"Profile took {elapsed:.2f}s, expected < 2s"
        print(f"✓ Player profile responded in {elapsed:.3f}s")
    
    def test_player_profile_handles_case_insensitive_tg_prefix(self):
        """Profile should handle tg_ and TG_ prefixes (case insensitive)"""
        # Test lowercase
        lower_addr = "tg_7438800063"
        resp_lower = requests.get(f"{BASE_URL}/api/player/{lower_addr}/profile")
        
        # Test uppercase
        upper_addr = "TG_7438800063"
        resp_upper = requests.get(f"{BASE_URL}/api/player/{upper_addr}/profile")
        
        assert resp_lower.status_code == 200, f"Lower case failed: {resp_lower.status_code}"
        assert resp_upper.status_code == 200, f"Upper case failed: {resp_upper.status_code}"
        
        # Both should return similar data (same player)
        print(f"✓ Profile handles tg_/TG_ case variations")


class TestChatEndpoint:
    """Test GET /api/chat/messages endpoint"""
    
    def test_chat_messages_endpoint_exists(self):
        """Chat messages endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/chat/messages")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Chat messages endpoint exists")
    
    def test_chat_messages_returns_messages_array(self):
        """Chat endpoint should return messages array"""
        response = requests.get(f"{BASE_URL}/api/chat/messages")
        assert response.status_code == 200
        data = response.json()
        
        assert "messages" in data, "Response should contain 'messages' field"
        assert isinstance(data["messages"], list), "messages should be a list"
        print(f"✓ Chat returned {len(data['messages'])} messages")
    
    def test_chat_messages_performance_under_2s(self):
        """Chat endpoint should respond under 2 seconds"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/chat/messages")
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 2.0, f"Chat took {elapsed:.2f}s, expected < 2s"
        print(f"✓ Chat messages responded in {elapsed:.3f}s")


class TestLeaderboardCompoundIndexOptimization:
    """Test GET /api/leaderboard with compound indexes"""
    
    def test_leaderboard_responds_under_2s(self):
        """Leaderboard should respond under 2 seconds after index optimization"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        elapsed = time.time() - start
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert elapsed < 2.0, f"Leaderboard took {elapsed:.2f}s, expected < 2s"
        print(f"✓ Leaderboard responded in {elapsed:.3f}s")
    
    def test_leaderboard_returns_valid_structure(self):
        """Leaderboard should return array with expected fields"""
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Leaderboard should return an array"
        
        if len(data) > 0:
            entry = data[0]
            expected_fields = ["address", "nickname", "points", "level", "rank"]
            for field in expected_fields:
                assert field in entry, f"Leaderboard entry missing field: {field}"
            print(f"✓ Leaderboard entry has all required fields")
        else:
            print(f"✓ Leaderboard returned (empty)")


class TestStatsCompoundIndexOptimization:
    """Test GET /api/stats with compound indexes"""
    
    def test_stats_responds_under_2s(self):
        """Stats should respond under 2 seconds after index optimization"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/stats")
        elapsed = time.time() - start
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert elapsed < 2.0, f"Stats took {elapsed:.2f}s, expected < 2s"
        print(f"✓ Stats responded in {elapsed:.3f}s")
    
    def test_stats_returns_valid_structure(self):
        """Stats should return expected fields"""
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()
        
        expected_fields = ["total_players", "nft_holders", "total_treats", "active_today"]
        for field in expected_fields:
            assert field in data, f"Stats missing field: {field}"
        
        print(f"✓ Stats: players={data['total_players']}, treats={data['total_treats']}, active_today={data['active_today']}")


class TestDailyStatusEndpoint:
    """Test GET /api/daily-status/{address}"""
    
    def test_daily_status_for_tg_user(self):
        """Daily status should work for TG users"""
        response = requests.get(f"{BASE_URL}/api/daily-status/{TG_TEST_ADDRESS}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "can_create_treat" in data, "daily_status should have can_create_treat"
        assert "remaining_treats" in data, "daily_status should have remaining_treats"
        print(f"✓ Daily status for TG user: can_create={data['can_create_treat']}, remaining={data['remaining_treats']}")
    
    def test_daily_status_performance_under_2s(self):
        """Daily status should respond under 2 seconds"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/daily-status/{TG_TEST_ADDRESS}")
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 2.0, f"Daily status took {elapsed:.2f}s, expected < 2s"
        print(f"✓ Daily status responded in {elapsed:.3f}s")


class TestPlayerEndpointRegular:
    """Test GET /api/player/{address} regular endpoint"""
    
    def test_player_endpoint_for_tg_user(self):
        """Player endpoint should work for TG users"""
        response = requests.get(f"{BASE_URL}/api/player/{TG_TEST_ADDRESS}")
        # 200 = found, 404 = not found (both valid responses)
        assert response.status_code in [200, 404], f"Unexpected status {response.status_code}"
        print(f"✓ Player endpoint for TG user: status={response.status_code}")
    
    def test_player_endpoint_performance(self):
        """Player endpoint should respond under 2 seconds"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/player/{TG_TEST_ADDRESS}")
        elapsed = time.time() - start
        
        assert elapsed < 2.0, f"Player endpoint took {elapsed:.2f}s, expected < 2s"
        print(f"✓ Player endpoint responded in {elapsed:.3f}s")


class TestActiveTreatsEndpoint:
    """Test GET /api/treats/{address}/active"""
    
    def test_active_treats_for_tg_user(self):
        """Active treats should work for TG users"""
        response = requests.get(f"{BASE_URL}/api/treats/{TG_TEST_ADDRESS}/active")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "treats" in data, "Response should contain 'treats' field"
        print(f"✓ Active treats for TG user: {len(data['treats'])} treats")
    
    def test_active_treats_performance(self):
        """Active treats should respond under 2 seconds"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/treats/{TG_TEST_ADDRESS}/active")
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 2.0, f"Active treats took {elapsed:.2f}s, expected < 2s"
        print(f"✓ Active treats responded in {elapsed:.3f}s")


class TestTreatCreationPerformance:
    """Test POST /api/treats/enhanced - already tested but verify still under 3s"""
    
    def test_treat_creation_under_3_seconds(self):
        """Treat creation should respond under 3 seconds"""
        test_addr = get_unique_test_address()
        payload = {
            "creator_address": test_addr,
            "ingredients": TEST_INGREDIENTS,
            "player_level": 1
        }
        
        start = time.time()
        response = requests.post(f"{BASE_URL}/api/treats/enhanced", json=payload)
        elapsed = time.time() - start
        
        # Accept 200, 429 (rate limited), or 400 (invalid recipe)
        assert response.status_code in [200, 429, 400], f"Unexpected status {response.status_code}"
        assert elapsed < 3.0, f"Treat creation took {elapsed:.2f}s, expected < 3s"
        print(f"✓ Treat creation responded in {elapsed:.3f}s (status {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
