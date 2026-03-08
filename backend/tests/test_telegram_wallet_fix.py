"""
Backend API tests for Telegram wallet bug verification.
Tests the /api/points/leaderboard endpoint sanity check.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://gamelab-polish.preview.emergentagent.com')


class TestLeaderboardAPI:
    """Test leaderboard API endpoint (backend sanity check for Telegram wallet bug)"""
    
    def test_leaderboard_returns_200(self):
        """Verify /api/points/leaderboard returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/points/leaderboard?limit=5")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✅ /api/points/leaderboard returns 200 OK")
    
    def test_leaderboard_response_structure(self):
        """Verify leaderboard response has correct structure"""
        response = requests.get(f"{BASE_URL}/api/points/leaderboard?limit=3")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check top-level structure
        assert "leaderboard" in data, "Response missing 'leaderboard' field"
        assert "generated_at" in data, "Response missing 'generated_at' field"
        
        leaderboard = data["leaderboard"]
        assert isinstance(leaderboard, list), "leaderboard should be a list"
        
        print(f"✅ Leaderboard contains {len(leaderboard)} entries")
        
        # Verify each entry structure if there are entries
        if len(leaderboard) > 0:
            entry = leaderboard[0]
            required_fields = ["rank", "address", "total_points", "level", "is_nft_holder"]
            for field in required_fields:
                assert field in entry, f"Entry missing required field: {field}"
            
            # Verify data types
            assert isinstance(entry["rank"], int), "rank should be int"
            assert isinstance(entry["total_points"], int), "total_points should be int"
            assert isinstance(entry["level"], int), "level should be int"
            assert isinstance(entry["is_nft_holder"], bool), "is_nft_holder should be bool"
            
            print(f"✅ Entry structure valid - Top player: {entry.get('nickname', 'N/A')} with {entry['total_points']} points")
    
    def test_leaderboard_respects_limit(self):
        """Verify leaderboard respects limit parameter"""
        response = requests.get(f"{BASE_URL}/api/points/leaderboard?limit=2")
        
        assert response.status_code == 200
        data = response.json()
        
        leaderboard = data["leaderboard"]
        assert len(leaderboard) <= 2, f"Expected <= 2 entries, got {len(leaderboard)}"
        
        print(f"✅ Limit parameter respected - got {len(leaderboard)} entries")
    
    def test_leaderboard_ranks_are_ordered(self):
        """Verify leaderboard entries are ranked in order"""
        response = requests.get(f"{BASE_URL}/api/points/leaderboard?limit=5")
        
        assert response.status_code == 200
        data = response.json()
        
        leaderboard = data["leaderboard"]
        
        if len(leaderboard) > 1:
            for i in range(1, len(leaderboard)):
                prev_rank = leaderboard[i-1]["rank"]
                curr_rank = leaderboard[i]["rank"]
                prev_points = leaderboard[i-1]["total_points"]
                curr_points = leaderboard[i]["total_points"]
                
                assert curr_rank > prev_rank, f"Ranks not in order: {prev_rank} -> {curr_rank}"
                assert prev_points >= curr_points, f"Points not in descending order"
            
            print("✅ Leaderboard ranks are properly ordered")


class TestHealthAPI:
    """Test health check API"""
    
    def test_health_endpoint(self):
        """Verify /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("status") == "healthy", f"Expected healthy status, got {data.get('status')}"
        assert "database" in data, "Response missing 'database' field"
        
        print(f"✅ Health check passed - DB: {data.get('database')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
