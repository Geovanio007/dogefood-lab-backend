"""
Test suite for DogeFood Lab Bug Fixes:
1. Timestamps in activity feed and chat now include UTC timezone markers (Z or +00:00)
2. Happy Hour +25% bonus points returned in API response
3. Kernel of Wow selects real players (not Anonymous/invalid addresses)
"""
import pytest
import requests
import os
import re
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTimestampUTCMarkers:
    """Bug 1: Verify timestamps include UTC timezone markers (Z or +00:00 suffix)"""
    
    def test_activity_recent_timestamps_have_utc(self):
        """Test /api/activity/recent timestamps have UTC markers"""
        response = requests.get(f"{BASE_URL}/api/activity/recent")
        assert response.status_code == 200, f"Activity API failed: {response.text}"
        
        data = response.json()
        activity = data.get("activity", [])
        
        if len(activity) == 0:
            pytest.skip("No activity data to test timestamps")
        
        # Check each activity item's created_at field
        for i, item in enumerate(activity[:5]):  # Check first 5 items
            created_at = item.get("created_at", "")
            if created_at:
                # Verify UTC marker: should end with Z or contain +00:00 or have timezone info
                has_utc_marker = (
                    created_at.endswith('Z') or 
                    '+00:00' in created_at or 
                    re.search(r'[+-]\d{2}:\d{2}$', created_at)
                )
                assert has_utc_marker, f"Activity item {i} timestamp '{created_at}' missing UTC marker (should end with Z or +00:00)"
                print(f"✅ Activity item {i}: {created_at} has UTC marker")
    
    def test_chat_messages_timestamps_have_utc(self):
        """Test /api/chat/messages timestamps have UTC markers"""
        response = requests.get(f"{BASE_URL}/api/chat/messages")
        assert response.status_code == 200, f"Chat API failed: {response.text}"
        
        data = response.json()
        messages = data.get("messages", [])
        
        if len(messages) == 0:
            pytest.skip("No chat messages to test timestamps")
        
        # Check each message's created_at field
        for i, msg in enumerate(messages[:5]):  # Check first 5 messages
            created_at = msg.get("created_at", "")
            if created_at:
                # Verify UTC marker
                has_utc_marker = (
                    created_at.endswith('Z') or 
                    '+00:00' in created_at or 
                    re.search(r'[+-]\d{2}:\d{2}$', created_at)
                )
                assert has_utc_marker, f"Chat message {i} timestamp '{created_at}' missing UTC marker"
                print(f"✅ Chat message {i}: {created_at} has UTC marker")
    
    def test_timestamps_are_iso_format(self):
        """Verify timestamps are valid ISO format and parseable"""
        response = requests.get(f"{BASE_URL}/api/activity/recent")
        assert response.status_code == 200
        
        activity = response.json().get("activity", [])
        for item in activity[:3]:
            created_at = item.get("created_at", "")
            if created_at:
                # Try parsing as ISO format
                try:
                    # Normalize Z to +00:00 for parsing
                    normalized = created_at.replace('Z', '+00:00')
                    parsed = datetime.fromisoformat(normalized)
                    print(f"✅ Timestamp '{created_at}' parsed successfully: {parsed}")
                except ValueError as e:
                    pytest.fail(f"Timestamp '{created_at}' is not valid ISO format: {e}")


class TestHappyHourBonus:
    """Bug 2: Verify Happy Hour +25% bonus is returned in API responses"""
    
    def test_happy_hour_status_returns_bonus_percent(self):
        """Test /api/happy-hour/status returns bonus_percent: 25"""
        response = requests.get(f"{BASE_URL}/api/happy-hour/status")
        assert response.status_code == 200, f"Happy Hour API failed: {response.text}"
        
        data = response.json()
        
        # Verify bonus_percent field exists and is 25
        assert "bonus_percent" in data, "Missing 'bonus_percent' field in happy hour status"
        assert data["bonus_percent"] == 25, f"Expected bonus_percent=25, got {data['bonus_percent']}"
        print(f"✅ Happy Hour bonus_percent: {data['bonus_percent']}%")
        
        # Verify timing info exists
        assert "start_hour_utc" in data, "Missing 'start_hour_utc' field"
        assert "duration_minutes" in data, "Missing 'duration_minutes' field"
        print(f"✅ Happy Hour starts at {data['start_hour_utc']}:00 UTC, duration: {data['duration_minutes']} mins")
    
    def test_happy_hour_status_has_active_flag(self):
        """Test happy hour status returns 'active' boolean"""
        response = requests.get(f"{BASE_URL}/api/happy-hour/status")
        assert response.status_code == 200
        
        data = response.json()
        
        # Must have active flag
        assert "active" in data, "Missing 'active' field"
        assert isinstance(data["active"], bool), "'active' should be boolean"
        
        # Should have timing info based on active state
        if data["active"]:
            assert "remaining_seconds" in data, "Active happy hour should have remaining_seconds"
            assert "message" in data, "Should have message"
            print(f"✅ Happy Hour is ACTIVE: {data['remaining_seconds']}s remaining")
        else:
            assert "seconds_until_next" in data or "next_start_utc" in data, "Inactive should have next start info"
            print(f"✅ Happy Hour is inactive, next starts: {data.get('next_start_utc', 'soon')}")
    
    def test_collect_treat_endpoint_structure(self):
        """Verify /api/treats/{id}/collect endpoint exists and returns expected structure"""
        # This is a POST endpoint - we can't test full flow without a real treat
        # But we can verify the endpoint returns proper error for missing data
        response = requests.post(f"{BASE_URL}/api/treats/fake-treat-id/collect", json={})
        
        # Should return 400 (missing player_address) or 404 (treat not found)
        assert response.status_code in [400, 404, 422], f"Unexpected status: {response.status_code}"
        print(f"✅ Collect endpoint responds correctly with status {response.status_code}")


class TestKernelOfWowHolder:
    """Bug 3: Verify Kernel of Wow selects real players (not Anonymous/invalid)"""
    
    def test_special_ingredient_current_endpoint(self):
        """Test /api/special-ingredient/current returns valid holder info"""
        response = requests.get(f"{BASE_URL}/api/special-ingredient/current")
        assert response.status_code == 200, f"Special ingredient API failed: {response.text}"
        
        data = response.json()
        
        # Must have has_holder flag
        assert "has_holder" in data, "Missing 'has_holder' field"
        
        # Must have ingredient info
        assert "ingredient" in data, "Missing 'ingredient' field"
        ingredient = data["ingredient"]
        assert ingredient.get("id") == "KERNEL_WOW", f"Wrong ingredient id: {ingredient.get('id')}"
        assert ingredient.get("name") == "Kernel of Wow", f"Wrong ingredient name"
        print(f"✅ Ingredient: {ingredient.get('name')} ({ingredient.get('rarity')})")
        
        return data
    
    def test_kernel_holder_is_real_player(self):
        """Verify the current Kernel holder is a real player (not Anonymous)"""
        response = requests.get(f"{BASE_URL}/api/special-ingredient/current")
        assert response.status_code == 200
        
        data = response.json()
        
        if not data.get("has_holder"):
            # No holder currently - this is valid, just skip the validation
            print("⚠️ No current Kernel holder - skipping player validation")
            pytest.skip("No current Kernel holder")
        
        holder = data.get("holder", {})
        
        # Verify holder has required fields
        player_address = holder.get("player_address", "")
        player_nickname = holder.get("player_nickname", "")
        
        # The holder should NOT be Anonymous or have invalid address
        assert player_nickname != "Anonymous", f"Kernel holder has 'Anonymous' nickname - bug not fixed!"
        assert player_nickname != "", "Kernel holder has empty nickname"
        assert player_nickname is not None, "Kernel holder nickname is None"
        
        # Address should not be the placeholder address
        assert player_address != "0x0000000000000000000000000000000000000001", \
            f"Kernel holder has invalid placeholder address: {player_address}"
        assert player_address != "", "Kernel holder has empty address"
        assert player_address is not None, "Kernel holder address is None"
        
        print(f"✅ Kernel holder: {player_nickname} ({player_address[:20]}...)")
        print(f"✅ Holder is a REAL player, not Anonymous!")
    
    def test_kernel_holder_has_valid_expiry(self):
        """Verify Kernel holder has valid expiration time"""
        response = requests.get(f"{BASE_URL}/api/special-ingredient/current")
        assert response.status_code == 200
        
        data = response.json()
        
        if not data.get("has_holder"):
            pytest.skip("No current Kernel holder")
        
        # Should have time_remaining_seconds
        assert "time_remaining_seconds" in data, "Missing time_remaining_seconds"
        time_remaining = data.get("time_remaining_seconds", 0)
        assert time_remaining >= 0, f"Invalid time remaining: {time_remaining}"
        
        # Holder should have expires_at
        holder = data.get("holder", {})
        assert "expires_at" in holder, "Holder missing expires_at"
        
        print(f"✅ Time remaining: {int(time_remaining // 3600)}h {int((time_remaining % 3600) // 60)}m")


class TestLeaderboard:
    """Verify leaderboard returns players with valid nicknames"""
    
    def test_leaderboard_returns_data(self):
        """Test /api/leaderboard endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200, f"Leaderboard API failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Leaderboard should return a list"
        
        print(f"✅ Leaderboard returned {len(data)} players")
        return data
    
    def test_leaderboard_players_have_valid_nicknames(self):
        """Verify leaderboard players have proper nicknames (not empty/None)"""
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200
        
        players = response.json()
        
        if len(players) == 0:
            pytest.skip("No players on leaderboard")
        
        # Check first 10 players
        for i, player in enumerate(players[:10]):
            nickname = player.get("nickname")
            address = player.get("address", "")
            
            # Nickname should not be empty or None
            assert nickname is not None, f"Player {i} ({address}) has None nickname"
            assert nickname != "", f"Player {i} ({address}) has empty nickname"
            assert nickname != "None", f"Player {i} ({address}) has 'None' string as nickname"
            
            # Points should be > 0 (leaderboard filter)
            points = player.get("points", 0)
            assert points > 0, f"Player {i} has 0 points on leaderboard"
            
            print(f"✅ #{player.get('rank')}: {nickname} - {points} pts")


class TestAPIEndpoints:
    """Basic API health checks"""
    
    def test_activity_endpoint(self):
        """Test /api/activity/recent endpoint"""
        response = requests.get(f"{BASE_URL}/api/activity/recent")
        assert response.status_code == 200
        assert "activity" in response.json()
        print("✅ Activity endpoint working")
    
    def test_chat_endpoint(self):
        """Test /api/chat/messages endpoint"""
        response = requests.get(f"{BASE_URL}/api/chat/messages")
        assert response.status_code == 200
        assert "messages" in response.json()
        print("✅ Chat endpoint working")
    
    def test_happy_hour_endpoint(self):
        """Test /api/happy-hour/status endpoint"""
        response = requests.get(f"{BASE_URL}/api/happy-hour/status")
        assert response.status_code == 200
        print("✅ Happy Hour endpoint working")
    
    def test_special_ingredient_endpoint(self):
        """Test /api/special-ingredient/current endpoint"""
        response = requests.get(f"{BASE_URL}/api/special-ingredient/current")
        assert response.status_code == 200
        print("✅ Special Ingredient endpoint working")
    
    def test_leaderboard_endpoint(self):
        """Test /api/leaderboard endpoint"""
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200
        print("✅ Leaderboard endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
