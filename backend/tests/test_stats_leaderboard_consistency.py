"""
Test file: Stats/Leaderboard Consistency and Telegram User Handling
Tests P0 bugs fixed in iteration 13:
- Active player count alignment between /api/stats and /api/leaderboard
- Telegram user lookup with TG_/tg_ case tolerance
- API performance requirements (<2s response times)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestStatsLeaderboardConsistency:
    """P0: Verify active player count aligns between /api/stats and /api/leaderboard"""
    
    def test_leaderboard_loads_with_entries(self):
        """Leaderboard API returns active players"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        elapsed = time.time() - start
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Leaderboard should be a list"
        assert len(data) > 0, "Leaderboard should have at least one entry"
        print(f"✓ Leaderboard returned {len(data)} entries in {elapsed:.2f}s")
        
    def test_stats_loads_with_active_players(self):
        """Stats API returns total_players count"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/stats")
        elapsed = time.time() - start
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "total_players" in data, "Stats should contain total_players"
        assert data["total_players"] >= 0, "total_players should be non-negative"
        print(f"✓ Stats returned total_players={data['total_players']} in {elapsed:.2f}s")
        
    def test_active_player_count_consistency(self):
        """P0: active player count in /api/stats should match /api/leaderboard entries"""
        leaderboard_resp = requests.get(f"{BASE_URL}/api/leaderboard")
        stats_resp = requests.get(f"{BASE_URL}/api/stats")
        
        assert leaderboard_resp.status_code == 200
        assert stats_resp.status_code == 200
        
        leaderboard = leaderboard_resp.json()
        stats = stats_resp.json()
        
        leaderboard_count = len(leaderboard)
        stats_count = stats.get("total_players", 0)
        
        assert leaderboard_count == stats_count, \
            f"Count mismatch: leaderboard has {leaderboard_count}, stats shows {stats_count}"
        print(f"✓ Counts match: {leaderboard_count} active players")


class TestTelegramUserHandling:
    """P0: Telegram user lookup/profile works with both tg_ and TG_ forms"""
    
    def test_profile_lookup_tg_lowercase(self):
        """Profile lookup with tg_ prefix works"""
        # Use a telegram ID from the leaderboard
        response = requests.get(f"{BASE_URL}/api/player/tg_7438800063/profile")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "telegram_id" in data or "address" in data, "Profile should have identifier"
        print(f"✓ tg_ lookup returned profile with telegram_id={data.get('telegram_id')}")
        
    def test_profile_lookup_TG_uppercase(self):
        """Profile lookup with TG_ prefix works"""
        response = requests.get(f"{BASE_URL}/api/player/TG_7438800063/profile")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "telegram_id" in data or "address" in data, "Profile should have identifier"
        print(f"✓ TG_ lookup returned profile with telegram_id={data.get('telegram_id')}")
        
    def test_both_forms_return_same_data(self):
        """Both tg_ and TG_ forms should return equivalent profile data"""
        tg_lower = requests.get(f"{BASE_URL}/api/player/tg_7438800063/profile").json()
        tg_upper = requests.get(f"{BASE_URL}/api/player/TG_7438800063/profile").json()
        
        # Same telegram_id should be returned
        assert tg_lower.get("telegram_id") == tg_upper.get("telegram_id"), \
            "Both forms should return same telegram_id"
        print(f"✓ Both forms return same telegram_id: {tg_lower.get('telegram_id')}")


class TestAPIPerformance:
    """P0: API performance requirements (<2s preferred)"""
    
    def test_leaderboard_performance(self):
        """Leaderboard API responds in < 2 seconds"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 2.0, f"Leaderboard took {elapsed:.2f}s, expected < 2s"
        print(f"✓ Leaderboard responded in {elapsed:.3f}s")
        
    def test_stats_performance(self):
        """Stats API responds in < 2 seconds"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/stats")
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 2.0, f"Stats took {elapsed:.2f}s, expected < 2s"
        print(f"✓ Stats responded in {elapsed:.3f}s")
        
    def test_chat_messages_performance(self):
        """Chat messages API responds in < 2 seconds"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/chat/messages?limit=50")
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 2.0, f"Chat messages took {elapsed:.2f}s, expected < 2s"
        print(f"✓ Chat messages responded in {elapsed:.3f}s")
        
    def test_happy_hour_status(self):
        """Happy hour status API responds correctly"""
        response = requests.get(f"{BASE_URL}/api/happy-hour/status")
        assert response.status_code == 200
        data = response.json()
        
        assert "active" in data, "Should have active field"
        assert "bonus_percent" in data, "Should have bonus_percent field"
        assert data["bonus_percent"] == 25, f"Expected bonus_percent=25, got {data['bonus_percent']}"
        print(f"✓ Happy hour status: active={data['active']}, bonus_percent={data['bonus_percent']}")


class TestLeaderboardDataQuality:
    """Verify leaderboard data quality and structure"""
    
    def test_leaderboard_entries_have_required_fields(self):
        """Each leaderboard entry should have required fields"""
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        data = response.json()
        
        required_fields = ["address", "nickname", "points", "level", "rank"]
        
        for entry in data[:10]:  # Check first 10 entries
            for field in required_fields:
                assert field in entry, f"Entry missing field: {field}"
        print(f"✓ First 10 entries have all required fields")
        
    def test_leaderboard_sorted_by_points(self):
        """Leaderboard should be sorted by points descending"""
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        data = response.json()
        
        if len(data) > 1:
            for i in range(len(data) - 1):
                assert data[i]["points"] >= data[i+1]["points"], \
                    f"Leaderboard not sorted: rank {i+1} has {data[i]['points']} pts, rank {i+2} has {data[i+1]['points']} pts"
        print(f"✓ Leaderboard is correctly sorted by points")
        
    def test_leaderboard_excludes_guest_user_placeholder(self):
        """Leaderboard should not include GUEST_USER placeholder"""
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        data = response.json()
        
        guest_users = [e for e in data if e.get("address") == "GUEST_USER"]
        assert len(guest_users) == 0, "Leaderboard should not include GUEST_USER placeholder"
        print(f"✓ No GUEST_USER placeholder in leaderboard")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
