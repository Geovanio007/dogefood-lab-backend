"""
Test suite for /api/points/leaderboard endpoint fix
Tests the fix for KeyError in get_points_leaderboard method
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLeaderboardEndpoint:
    """Tests for GET /api/points/leaderboard endpoint - verifies KeyError fix"""

    def test_leaderboard_returns_200(self):
        """Test that leaderboard endpoint returns 200 status"""
        response = requests.get(f"{BASE_URL}/api/points/leaderboard?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Leaderboard endpoint returns 200 OK")
    
    def test_leaderboard_response_structure(self):
        """Test that response has correct structure with leaderboard array"""
        response = requests.get(f"{BASE_URL}/api/points/leaderboard?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "leaderboard" in data, "Response missing 'leaderboard' key"
        assert isinstance(data["leaderboard"], list), "leaderboard should be a list"
        assert "generated_at" in data, "Response missing 'generated_at' timestamp"
        print(f"✓ Leaderboard response has correct structure with {len(data['leaderboard'])} entries")
    
    def test_leaderboard_entry_fields(self):
        """Test that each leaderboard entry has all required fields (no KeyError)"""
        response = requests.get(f"{BASE_URL}/api/points/leaderboard?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        required_fields = ["rank", "address", "nickname", "total_points", "weekly_points", "level", "is_nft_holder", "last_active"]
        
        for i, entry in enumerate(data["leaderboard"]):
            for field in required_fields:
                assert field in entry, f"Entry {i} missing required field '{field}'"
            
            # Verify data types - the fix should ensure no KeyError and proper types
            assert isinstance(entry["rank"], int), f"Entry {i}: rank should be int"
            assert isinstance(entry["address"], str), f"Entry {i}: address should be str"
            assert isinstance(entry["total_points"], int), f"Entry {i}: total_points should be int"
            assert isinstance(entry["weekly_points"], int), f"Entry {i}: weekly_points should be int"
            assert isinstance(entry["level"], int), f"Entry {i}: level should be int"
            assert isinstance(entry["is_nft_holder"], bool), f"Entry {i}: is_nft_holder should be bool"
        
        print(f"✓ All {len(data['leaderboard'])} entries have correct fields and types (KeyError fix verified)")

    def test_leaderboard_with_nft_holders_only_true(self):
        """Test leaderboard filtered to NFT holders only"""
        response = requests.get(f"{BASE_URL}/api/points/leaderboard?limit=10&nft_holders_only=true")
        assert response.status_code == 200
        
        data = response.json()
        for entry in data["leaderboard"]:
            assert entry["is_nft_holder"] == True, f"Entry {entry['address']} should be NFT holder"
        
        print(f"✓ NFT holders only filter works correctly ({len(data['leaderboard'])} entries)")
    
    def test_leaderboard_with_nft_holders_only_false(self):
        """Test leaderboard includes non-NFT holders when filter is false"""
        response = requests.get(f"{BASE_URL}/api/points/leaderboard?limit=50&nft_holders_only=false")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["leaderboard"]) > 0, "Should have at least one entry"
        print(f"✓ All players leaderboard returns {len(data['leaderboard'])} entries")
    
    def test_leaderboard_limit_parameter(self):
        """Test that limit parameter is respected"""
        response = requests.get(f"{BASE_URL}/api/points/leaderboard?limit=3")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["leaderboard"]) <= 3, "Should respect limit parameter"
        print(f"✓ Limit parameter works correctly (requested 3, got {len(data['leaderboard'])})")
    
    def test_leaderboard_ranks_are_sequential(self):
        """Test that ranks are properly assigned sequentially"""
        response = requests.get(f"{BASE_URL}/api/points/leaderboard?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        for i, entry in enumerate(data["leaderboard"]):
            assert entry["rank"] == i + 1, f"Entry {i} should have rank {i + 1}, got {entry['rank']}"
        
        print("✓ Ranks are assigned sequentially")
    
    def test_leaderboard_sorted_by_points(self):
        """Test that leaderboard is sorted by total_points descending"""
        response = requests.get(f"{BASE_URL}/api/points/leaderboard?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        points = [entry["total_points"] for entry in data["leaderboard"]]
        
        # Verify descending order
        assert points == sorted(points, reverse=True), "Leaderboard should be sorted by points descending"
        print("✓ Leaderboard is correctly sorted by total_points descending")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
