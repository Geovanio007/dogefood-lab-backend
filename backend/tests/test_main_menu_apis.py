"""
Test Suite for Main Menu API Endpoints
Tests the backend APIs that power the redesigned main menu:
- /api/stats - Game statistics
- /api/activity/recent - Live activity feed
- /api/happy-hour/status - Happy hour bonus status
"""

import pytest
import requests
import os

# Use REACT_APP_BACKEND_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMainMenuAPIs:
    """Test main menu backend APIs"""
    
    def test_stats_endpoint(self):
        """Test /api/stats returns valid game statistics"""
        response = requests.get(f"{BASE_URL}/api/stats")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data structure assertions
        data = response.json()
        assert "total_players" in data, "Missing total_players field"
        assert "total_treats" in data, "Missing total_treats field"
        assert "nft_holders" in data, "Missing nft_holders field"
        
        # Data type assertions
        assert isinstance(data["total_players"], int), "total_players should be int"
        assert isinstance(data["total_treats"], int), "total_treats should be int"
        assert isinstance(data["nft_holders"], int), "nft_holders should be int"
        
        # Value assertions (should have some data)
        assert data["total_players"] >= 0, "total_players should be non-negative"
        assert data["total_treats"] >= 0, "total_treats should be non-negative"
        
        print(f"✅ Stats: {data['total_players']} players, {data['total_treats']} treats, {data['nft_holders']} NFT holders")
    
    def test_activity_recent_endpoint(self):
        """Test /api/activity/recent returns valid activity data"""
        response = requests.get(f"{BASE_URL}/api/activity/recent?limit=10")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data structure assertions
        data = response.json()
        assert "activity" in data, "Missing activity field"
        assert isinstance(data["activity"], list), "activity should be a list"
        
        # If there are activity items, verify structure
        if data["activity"]:
            item = data["activity"][0]
            # Verify expected fields (may be optional)
            assert "treat_name" in item or "rarity" in item, "Activity item should have treat_name or rarity"
            print(f"✅ Activity: {len(data['activity'])} recent items")
        else:
            print("✅ Activity: 0 recent items (expected - may be no recent activity)")
    
    def test_happy_hour_status_endpoint(self):
        """Test /api/happy-hour/status returns valid happy hour data"""
        response = requests.get(f"{BASE_URL}/api/happy-hour/status")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data structure assertions
        data = response.json()
        assert "active" in data, "Missing active field"
        assert "bonus_percent" in data, "Missing bonus_percent field"
        assert "start_hour_utc" in data, "Missing start_hour_utc field"
        assert "duration_minutes" in data, "Missing duration_minutes field"
        
        # Data type assertions
        assert isinstance(data["active"], bool), "active should be boolean"
        assert isinstance(data["bonus_percent"], int), "bonus_percent should be int"
        
        # Value assertions
        assert data["bonus_percent"] == 25, f"Expected 25% bonus, got {data['bonus_percent']}%"
        assert data["start_hour_utc"] == 15, f"Expected start at 15 UTC, got {data['start_hour_utc']}"
        assert data["duration_minutes"] == 60, f"Expected 60 min duration, got {data['duration_minutes']}"
        
        if data["active"]:
            print(f"✅ Happy Hour: ACTIVE (remaining: {data.get('remaining_seconds', 'N/A')}s)")
        else:
            print(f"✅ Happy Hour: Inactive (next at {data.get('next_start_utc', 'N/A')})")
    
    def test_leaderboard_endpoint(self):
        """Test /api/leaderboard returns valid leaderboard data"""
        response = requests.get(f"{BASE_URL}/api/leaderboard?limit=10")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data should be a list of leaderboard entries
        data = response.json()
        assert isinstance(data, list), "Leaderboard should return a list"
        
        # If there are entries, verify structure
        if data:
            entry = data[0]
            assert "address" in entry or "nickname" in entry, "Entry should have address or nickname"
            assert "points" in entry, "Entry should have points"
            assert "rank" in entry, "Entry should have rank"
            print(f"✅ Leaderboard: {len(data)} entries, top player has {data[0].get('points', 0)} points")
        else:
            print("✅ Leaderboard: No entries (may be empty)")


class TestGuestRegistration:
    """Test guest registration endpoint"""
    
    def test_guest_register_endpoint_exists(self):
        """Test that guest registration endpoint exists"""
        # Test with invalid data to verify endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/players/guest-register",
            json={"username": ""}
        )
        
        # Should return 400 for invalid username, not 404
        assert response.status_code in [400, 422], f"Expected 400/422 for invalid data, got {response.status_code}"
        print("✅ Guest registration endpoint exists")
    
    def test_guest_register_validation(self):
        """Test that guest registration validates username"""
        # Test with too short username
        response = requests.post(
            f"{BASE_URL}/api/players/guest-register",
            json={"username": "ab"}  # Less than 3 chars
        )
        
        # Should reject short usernames
        assert response.status_code in [400, 422], f"Expected validation error for short username"
        print("✅ Guest registration validates username length")


class TestHealthEndpoints:
    """Test basic health and connectivity"""
    
    def test_root_endpoint(self):
        """Test root endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✅ Root endpoint healthy")
    
    def test_health_endpoint(self):
        """Test /api/health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("status") == "healthy", f"Expected healthy status"
        print(f"✅ Health endpoint: {data.get('status')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
