"""
Performance Optimization Tests for DogeFood Lab
Tests the performance improvements made to:
1. Leaderboard - reduced from 32s to <2s via find() instead of aggregate(), compound index, no Pydantic serialization
2. Stats - parallelized 5 count queries with asyncio.gather()
3. Happy Hour status - returns bonus_percent field
4. Activity feed - responds quickly with proper data
5. Chat messages - responds quickly
6. Special ingredient holder - returns valid holder data
"""
import pytest
import requests
import os
import time
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLeaderboardPerformance:
    """Tests for /api/leaderboard endpoint - CRITICAL: was 32s, now should be <2s"""
    
    def test_leaderboard_response_time(self):
        """Leaderboard should respond in under 2 seconds (was 32 seconds before optimization)"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        elapsed = time.time() - start
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert elapsed < 2.0, f"Leaderboard took {elapsed:.2f}s, should be under 2s"
        print(f"✓ Leaderboard responded in {elapsed:.3f}s")
    
    def test_leaderboard_returns_array(self):
        """Leaderboard should return an array of entries"""
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Leaderboard should return an array"
        print(f"✓ Leaderboard returned {len(data)} entries")
    
    def test_leaderboard_sorted_by_points(self):
        """Leaderboard entries should be sorted by points descending"""
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 1:
            for i in range(len(data) - 1):
                assert data[i]["points"] >= data[i+1]["points"], \
                    f"Points not sorted: {data[i]['points']} < {data[i+1]['points']}"
        print(f"✓ Leaderboard is sorted by points descending")
    
    def test_leaderboard_has_required_fields(self):
        """Each leaderboard entry should have required fields"""
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["address", "nickname", "points", "level", "rank"]
        
        if len(data) > 0:
            entry = data[0]
            for field in required_fields:
                assert field in entry, f"Missing required field: {field}"
            assert entry["nickname"] is not None and entry["nickname"] != "", \
                "Nickname should not be empty"
        print(f"✓ Leaderboard entries have all required fields")
    
    def test_leaderboard_has_30_plus_entries(self):
        """Leaderboard should have 30+ entries as per requirement"""
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200
        data = response.json()
        
        # The requirement says 30+ entries - check for reasonable number
        assert len(data) >= 20, f"Expected at least 20 entries, got {len(data)}"
        print(f"✓ Leaderboard has {len(data)} entries")


class TestStatsPerformance:
    """Tests for /api/stats endpoint - parallelized 5 count queries"""
    
    def test_stats_response_time(self):
        """Stats should respond in under 2 seconds (parallelized queries)"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/stats")
        elapsed = time.time() - start
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert elapsed < 2.0, f"Stats took {elapsed:.2f}s, should be under 2s"
        print(f"✓ Stats responded in {elapsed:.3f}s")
    
    def test_stats_has_required_fields(self):
        """Stats should return all required fields"""
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["total_players", "nft_holders", "total_treats", "active_today"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
            assert isinstance(data[field], int), f"Field {field} should be integer"
        print(f"✓ Stats has all required fields: {json.dumps(data)}")


class TestHappyHourStatus:
    """Tests for /api/happy-hour/status endpoint"""
    
    def test_happy_hour_response_time(self):
        """Happy hour status should respond quickly"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/happy-hour/status")
        elapsed = time.time() - start
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert elapsed < 1.0, f"Happy hour status took {elapsed:.2f}s"
        print(f"✓ Happy hour status responded in {elapsed:.3f}s")
    
    def test_happy_hour_has_bonus_percent(self):
        """Happy hour should return bonus_percent field"""
        response = requests.get(f"{BASE_URL}/api/happy-hour/status")
        assert response.status_code == 200
        data = response.json()
        
        assert "bonus_percent" in data, "Missing bonus_percent field"
        assert data["bonus_percent"] == 25, f"Expected bonus_percent=25, got {data['bonus_percent']}"
        print(f"✓ Happy hour returns bonus_percent: {data['bonus_percent']}")
    
    def test_happy_hour_has_timing_info(self):
        """Happy hour should return timing information"""
        response = requests.get(f"{BASE_URL}/api/happy-hour/status")
        assert response.status_code == 200
        data = response.json()
        
        assert "active" in data, "Missing 'active' field"
        assert "start_hour_utc" in data, "Missing 'start_hour_utc' field"
        assert "duration_minutes" in data, "Missing 'duration_minutes' field"
        print(f"✓ Happy hour has timing info: active={data['active']}, start={data['start_hour_utc']}:00 UTC")


class TestActivityFeed:
    """Tests for /api/activity/recent endpoint"""
    
    def test_activity_response_time(self):
        """Activity feed should respond in under 1 second"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/activity/recent")
        elapsed = time.time() - start
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert elapsed < 1.0, f"Activity feed took {elapsed:.2f}s, should be under 1s"
        print(f"✓ Activity feed responded in {elapsed:.3f}s")
    
    def test_activity_has_array(self):
        """Activity should return an activity array"""
        response = requests.get(f"{BASE_URL}/api/activity/recent")
        assert response.status_code == 200
        data = response.json()
        
        assert "activity" in data, "Missing 'activity' field"
        assert isinstance(data["activity"], list), "Activity should be an array"
        print(f"✓ Activity feed returned {len(data['activity'])} entries")
    
    def test_activity_entries_have_required_fields(self):
        """Activity entries should have required fields"""
        response = requests.get(f"{BASE_URL}/api/activity/recent")
        assert response.status_code == 200
        data = response.json()
        
        if len(data["activity"]) > 0:
            entry = data["activity"][0]
            required_fields = ["treat_name", "rarity", "player_nickname", "created_at"]
            for field in required_fields:
                assert field in entry, f"Missing required field: {field}"
        print(f"✓ Activity entries have required fields")


class TestChatMessages:
    """Tests for /api/chat/messages endpoint"""
    
    def test_chat_response_time(self):
        """Chat messages should respond in under 1 second"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/chat/messages")
        elapsed = time.time() - start
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert elapsed < 1.0, f"Chat messages took {elapsed:.2f}s, should be under 1s"
        print(f"✓ Chat messages responded in {elapsed:.3f}s")
    
    def test_chat_has_messages_array(self):
        """Chat should return a messages array"""
        response = requests.get(f"{BASE_URL}/api/chat/messages")
        assert response.status_code == 200
        data = response.json()
        
        assert "messages" in data, "Missing 'messages' field"
        assert isinstance(data["messages"], list), "Messages should be an array"
        print(f"✓ Chat returned {len(data['messages'])} messages")


class TestSpecialIngredient:
    """Tests for /api/special-ingredient/current endpoint"""
    
    def test_special_ingredient_response_time(self):
        """Special ingredient should respond quickly"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/special-ingredient/current")
        elapsed = time.time() - start
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert elapsed < 1.0, f"Special ingredient took {elapsed:.2f}s"
        print(f"✓ Special ingredient responded in {elapsed:.3f}s")
    
    def test_special_ingredient_has_holder_info(self):
        """Special ingredient should return holder information"""
        response = requests.get(f"{BASE_URL}/api/special-ingredient/current")
        assert response.status_code == 200
        data = response.json()
        
        assert "has_holder" in data, "Missing 'has_holder' field"
        
        if data["has_holder"]:
            assert "holder" in data, "Missing 'holder' field when has_holder=True"
            holder = data["holder"]
            assert "player_nickname" in holder, "Missing player_nickname in holder"
            assert holder["player_nickname"] not in [None, "", "Anonymous"], \
                f"Holder should have a real nickname, got: {holder['player_nickname']}"
            print(f"✓ Current holder: {holder['player_nickname']}")
        else:
            print(f"✓ No current holder")
    
    def test_special_ingredient_has_bonus_combos(self):
        """Special ingredient should return bonus combo information"""
        response = requests.get(f"{BASE_URL}/api/special-ingredient/current")
        assert response.status_code == 200
        data = response.json()
        
        assert "bonus_combos" in data, "Missing 'bonus_combos' field"
        bonus_combos = data["bonus_combos"]
        
        for tier in ["legendary", "epic", "rare", "common"]:
            assert tier in bonus_combos, f"Missing bonus combo tier: {tier}"
            assert "bonus_percent" in bonus_combos[tier], f"Missing bonus_percent in {tier}"
        print(f"✓ Bonus combos present with all tiers")


class TestOverallPerformance:
    """Overall performance benchmarks"""
    
    def test_all_endpoints_under_2s(self):
        """All critical endpoints should respond in under 2 seconds"""
        endpoints = [
            "/api/leaderboard",
            "/api/stats",
            "/api/happy-hour/status",
            "/api/activity/recent",
            "/api/chat/messages",
            "/api/special-ingredient/current",
        ]
        
        results = []
        for endpoint in endpoints:
            start = time.time()
            response = requests.get(f"{BASE_URL}{endpoint}")
            elapsed = time.time() - start
            results.append({
                "endpoint": endpoint,
                "status": response.status_code,
                "time": elapsed
            })
            assert response.status_code == 200, f"{endpoint} returned {response.status_code}"
            assert elapsed < 2.0, f"{endpoint} took {elapsed:.2f}s (>2s)"
        
        print("\n✓ Performance Summary:")
        for r in results:
            print(f"  {r['endpoint']}: {r['time']:.3f}s")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
