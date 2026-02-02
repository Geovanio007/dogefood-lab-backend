"""
Auto-Mixer Subscription API Tests
Tests for the new Auto-Mixer subscription feature that allows players to subscribe
for 30 DOGE/month and have the system automatically mix treats during a selected
6-hour daily window.
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAutoMixerConfig:
    """Tests for GET /api/auto-mixer/config endpoint"""
    
    def test_get_config_success(self):
        """Config endpoint returns 200 with correct configuration"""
        response = requests.get(f"{BASE_URL}/api/auto-mixer/config")
        assert response.status_code == 200
        
        data = response.json()
        # Verify config structure and values
        assert "monthly_fee_doge" in data
        assert data["monthly_fee_doge"] == 30
        assert "max_window_hours" in data
        assert data["max_window_hours"] == 6
        assert "min_window_hours" in data
        assert data["min_window_hours"] == 1
        assert "payment_address" in data
        assert data["payment_address"].startswith("D")  # DOGE address
        assert "buy_burn_percent" in data
        assert data["buy_burn_percent"] == 80
        assert "dev_percent" in data
        assert data["dev_percent"] == 20
        assert "mixes_per_hour" in data
        assert data["mixes_per_hour"] == 2


class TestAutoMixerFundsStats:
    """Tests for GET /api/auto-mixer/funds-stats endpoint"""
    
    def test_get_funds_stats_success(self):
        """Funds stats endpoint returns 200 with correct statistics"""
        response = requests.get(f"{BASE_URL}/api/auto-mixer/funds-stats")
        assert response.status_code == 200
        
        data = response.json()
        # Verify stats structure
        assert "total_received_doge" in data
        assert "buy_burn_amount" in data
        assert "dev_amount" in data
        assert "total_subscribers" in data
        assert "active_subscribers" in data
        assert "total_auto_mixes" in data
        assert "buy_burn_percent" in data
        assert "dev_percent" in data
        
        # Verify types
        assert isinstance(data["total_received_doge"], (int, float))
        assert isinstance(data["total_subscribers"], int)
        assert isinstance(data["active_subscribers"], int)
        assert isinstance(data["total_auto_mixes"], int)


class TestAutoMixerSubscription:
    """Tests for subscription CRUD operations"""
    
    @pytest.fixture
    def test_address(self):
        """Generate unique test address for each test"""
        return f"TEST_automixer_{uuid.uuid4().hex[:16]}"
    
    def test_get_subscription_no_subscription(self, test_address):
        """Returns null subscription when player has no subscription"""
        response = requests.get(f"{BASE_URL}/api/auto-mixer/subscription/{test_address}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["subscription"] is None
        assert data["has_subscription"] == False
    
    def test_create_subscription_success(self, test_address):
        """Create subscription returns pending subscription"""
        payload = {
            "player_address": test_address,
            "window_start_hour": 9,
            "window_end_hour": 15
        }
        response = requests.post(
            f"{BASE_URL}/api/auto-mixer/create-subscription",
            json=payload
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify subscription structure
        assert "subscription" in data
        sub = data["subscription"]
        assert sub["player_address"] == test_address
        assert sub["status"] == "pending"
        assert sub["window_start_hour"] == 9
        assert sub["window_end_hour"] == 15
        assert sub["payment_amount"] == 30
        assert sub["payment_confirmed"] == False
        assert "id" in sub
        
        # Verify payment info
        assert "payment_address" in data
        assert "payment_amount" in data
        assert data["payment_amount"] == 30
    
    def test_create_subscription_invalid_window_too_long(self, test_address):
        """Create subscription fails with window > 6 hours"""
        payload = {
            "player_address": test_address,
            "window_start_hour": 9,
            "window_end_hour": 20  # 11 hours - too long
        }
        response = requests.post(
            f"{BASE_URL}/api/auto-mixer/create-subscription",
            json=payload
        )
        assert response.status_code == 400
    
    def test_create_subscription_returns_existing(self, test_address):
        """Creating subscription twice returns existing subscription"""
        payload = {
            "player_address": test_address,
            "window_start_hour": 10,
            "window_end_hour": 16
        }
        
        # Create first subscription
        response1 = requests.post(
            f"{BASE_URL}/api/auto-mixer/create-subscription",
            json=payload
        )
        assert response1.status_code == 200
        sub_id1 = response1.json()["subscription"]["id"]
        
        # Try to create second subscription
        response2 = requests.post(
            f"{BASE_URL}/api/auto-mixer/create-subscription",
            json=payload
        )
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Should return existing subscription with flag
        assert data2["subscription"]["id"] == sub_id1
        assert data2["existing"] == True
    
    def test_get_subscription_after_create(self, test_address):
        """Get subscription returns created subscription"""
        # Create subscription
        create_payload = {
            "player_address": test_address,
            "window_start_hour": 11,
            "window_end_hour": 17
        }
        create_response = requests.post(
            f"{BASE_URL}/api/auto-mixer/create-subscription",
            json=create_payload
        )
        assert create_response.status_code == 200
        created_sub = create_response.json()["subscription"]
        
        # Get subscription
        get_response = requests.get(f"{BASE_URL}/api/auto-mixer/subscription/{test_address}")
        assert get_response.status_code == 200
        
        data = get_response.json()
        assert data["has_subscription"] == True
        assert data["subscription"]["id"] == created_sub["id"]
        assert data["subscription"]["player_address"] == test_address


class TestAutoMixerUpdateWindow:
    """Tests for update window functionality"""
    
    @pytest.fixture
    def test_address(self):
        return f"TEST_automixer_update_{uuid.uuid4().hex[:16]}"
    
    def test_update_window_requires_active_subscription(self, test_address):
        """Update window fails for pending subscription"""
        # Create pending subscription
        create_payload = {
            "player_address": test_address,
            "window_start_hour": 9,
            "window_end_hour": 15
        }
        create_response = requests.post(
            f"{BASE_URL}/api/auto-mixer/create-subscription",
            json=create_payload
        )
        assert create_response.status_code == 200
        sub_id = create_response.json()["subscription"]["id"]
        
        # Try to update window
        update_payload = {
            "subscription_id": sub_id,
            "player_address": test_address,
            "window_start_hour": 10,
            "window_end_hour": 16
        }
        update_response = requests.post(
            f"{BASE_URL}/api/auto-mixer/update-window",
            json=update_payload
        )
        # Should fail because subscription is pending, not active
        assert update_response.status_code == 404
        assert "Active subscription not found" in update_response.json()["detail"]


class TestAutoMixerHistory:
    """Tests for mix history endpoint"""
    
    def test_get_history_no_subscription(self):
        """Get history for non-existent subscription"""
        response = requests.get(f"{BASE_URL}/api/auto-mixer/history/nonexistent_address_12345")
        assert response.status_code == 200
        
        data = response.json()
        assert "history" in data
        assert data["history"] == []


class TestAutoMixerEdgeCases:
    """Edge case tests for auto-mixer feature"""
    
    def test_window_wraps_around_midnight(self):
        """Window can wrap around midnight (e.g., 22:00 to 04:00)"""
        test_address = f"TEST_automixer_midnight_{uuid.uuid4().hex[:16]}"
        payload = {
            "player_address": test_address,
            "window_start_hour": 22,
            "window_end_hour": 4  # 6 hours wrapping midnight
        }
        response = requests.post(
            f"{BASE_URL}/api/auto-mixer/create-subscription",
            json=payload
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["subscription"]["window_start_hour"] == 22
        assert data["subscription"]["window_end_hour"] == 4
    
    def test_minimum_window_1_hour(self):
        """Minimum window size is 1 hour"""
        test_address = f"TEST_automixer_min_{uuid.uuid4().hex[:16]}"
        payload = {
            "player_address": test_address,
            "window_start_hour": 10,
            "window_end_hour": 11  # 1 hour - minimum valid
        }
        response = requests.post(
            f"{BASE_URL}/api/auto-mixer/create-subscription",
            json=payload
        )
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
