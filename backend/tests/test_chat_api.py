"""
Test Chat API Endpoints
Tests for GET /api/chat/messages and POST /api/chat/send
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://nft-leaderboard-fix.preview.emergentagent.com').rstrip('/')

class TestChatAPI:
    """Chat endpoint tests"""
    
    def test_get_chat_messages_returns_valid_response(self):
        """GET /api/chat/messages should return valid response with messages array"""
        response = requests.get(f"{BASE_URL}/api/chat/messages?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "messages" in data
        assert isinstance(data["messages"], list)
        print(f"✅ GET /api/chat/messages - Status: 200, Messages count: {len(data['messages'])}")
    
    def test_post_chat_send_missing_player_returns_error(self):
        """POST /api/chat/send should return 400 for missing player_id"""
        response = requests.post(f"{BASE_URL}/api/chat/send", json={
            "player_id": "",
            "message": "test message"
        })
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "player_id" in data["detail"].lower() or "required" in data["detail"].lower()
        print(f"✅ POST /api/chat/send (missing player) - Status: 400, Detail: {data['detail']}")
    
    def test_post_chat_send_missing_message_returns_error(self):
        """POST /api/chat/send should return 400 for missing message"""
        response = requests.post(f"{BASE_URL}/api/chat/send", json={
            "player_id": "test_player_123",
            "message": ""
        })
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"✅ POST /api/chat/send (empty message) - Status: 400, Detail: {data['detail']}")
    
    def test_post_chat_send_validates_required_fields(self):
        """POST /api/chat/send should validate both player_id and message"""
        response = requests.post(f"{BASE_URL}/api/chat/send", json={})
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"✅ POST /api/chat/send (empty body) - Status: 400")
    
    def test_post_chat_send_nonexistent_player(self):
        """POST /api/chat/send should return 404 for non-existent player"""
        response = requests.post(f"{BASE_URL}/api/chat/send", json={
            "player_id": "nonexistent_player_xyz_12345",
            "message": "Hello world!"
        })
        # Should be 404 for player not found
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        print(f"✅ POST /api/chat/send (nonexistent player) - Status: 404")


class TestMainMenuAPIs:
    """Test other main menu related APIs"""
    
    def test_stats_endpoint(self):
        """GET /api/stats should return game statistics"""
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_players" in data or "total_treats" in data
        print(f"✅ GET /api/stats - Status: 200")
    
    def test_activity_recent(self):
        """GET /api/activity/recent should return activity array"""
        response = requests.get(f"{BASE_URL}/api/activity/recent?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert "activity" in data
        assert isinstance(data["activity"], list)
        print(f"✅ GET /api/activity/recent - Status: 200, Activity count: {len(data['activity'])}")
    
    def test_happy_hour_status(self):
        """GET /api/happy-hour/status should return status info"""
        response = requests.get(f"{BASE_URL}/api/happy-hour/status")
        assert response.status_code == 200
        data = response.json()
        assert "active" in data
        assert "bonus_percent" in data
        print(f"✅ GET /api/happy-hour/status - Status: 200, Active: {data['active']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
