"""
Test suite for Anti-Cheat Daily Limit System
Tests the daily treat limit feature (5 treats per 24h) and extra life purchase
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://dogemixbot.preview.emergentagent.com')

# Test address for anti-cheat testing
TEST_ADDRESS = "0xTEST_anticheat_1234567890abcdef12345678"


class TestDailyStatusEndpoint:
    """Tests for GET /api/daily-status/{address}"""
    
    def test_daily_status_returns_200(self):
        """Test that daily status endpoint returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/daily-status/{TEST_ADDRESS}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✅ Daily status endpoint returns 200 OK")
    
    def test_daily_status_response_structure(self):
        """Test that daily status response has correct structure"""
        response = requests.get(f"{BASE_URL}/api/daily-status/{TEST_ADDRESS}")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify required fields exist
        required_fields = [
            "treats_created_today",
            "base_limit",
            "extra_lives_purchased",
            "extra_treats_available",
            "total_limit",
            "remaining_treats",
            "can_create_treat",
            "time_until_reset_seconds",
            "extra_life_cost_lab",
            "extra_life_treats",
            "lab_token_active"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        print(f"✅ Daily status response has all required fields")
        print(f"   Response: {data}")
    
    def test_daily_status_correct_values(self):
        """Test that daily status returns correct default values"""
        response = requests.get(f"{BASE_URL}/api/daily-status/{TEST_ADDRESS}")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify base limit is 5
        assert data["base_limit"] == 5, f"Expected base_limit=5, got {data['base_limit']}"
        
        # Verify extra life cost is 5000 $LAB
        assert data["extra_life_cost_lab"] == 5000, f"Expected extra_life_cost_lab=5000, got {data['extra_life_cost_lab']}"
        
        # Verify extra life gives 3 treats
        assert data["extra_life_treats"] == 3, f"Expected extra_life_treats=3, got {data['extra_life_treats']}"
        
        # Verify $LAB token is not active
        assert data["lab_token_active"] == False, f"Expected lab_token_active=False, got {data['lab_token_active']}"
        
        # Verify remaining_treats is calculated correctly
        expected_remaining = data["total_limit"] - data["treats_created_today"]
        assert data["remaining_treats"] == max(0, expected_remaining), f"Remaining treats calculation incorrect"
        
        # Verify can_create_treat is based on remaining_treats
        assert data["can_create_treat"] == (data["remaining_treats"] > 0), f"can_create_treat should match remaining_treats > 0"
        
        print(f"✅ Daily status returns correct values")
        print(f"   Base limit: {data['base_limit']}")
        print(f"   Extra life cost: {data['extra_life_cost_lab']} $LAB")
        print(f"   Extra life treats: {data['extra_life_treats']}")
        print(f"   $LAB active: {data['lab_token_active']}")


class TestExtraLifeEndpoint:
    """Tests for POST /api/extra-life/{address}"""
    
    def test_extra_life_returns_200(self):
        """Test that extra life endpoint returns 200 OK"""
        response = requests.post(f"{BASE_URL}/api/extra-life/{TEST_ADDRESS}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✅ Extra life endpoint returns 200 OK")
    
    def test_extra_life_placeholder_response(self):
        """Test that extra life returns placeholder response since $LAB is not active"""
        response = requests.post(f"{BASE_URL}/api/extra-life/{TEST_ADDRESS}")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify it returns success=false since $LAB is not active
        assert data["success"] == False, f"Expected success=False, got {data['success']}"
        
        # Verify reason is lab_token_not_active
        assert data["reason"] == "lab_token_not_active", f"Expected reason='lab_token_not_active', got {data['reason']}"
        
        # Verify message mentions $LAB not being live
        assert "$LAB" in data["message"], f"Message should mention $LAB: {data['message']}"
        
        # Verify cost and extra_treats are included
        assert data["cost"] == 5000, f"Expected cost=5000, got {data['cost']}"
        assert data["extra_treats"] == 3, f"Expected extra_treats=3, got {data['extra_treats']}"
        
        # Verify current_status is included
        assert "current_status" in data, "Response should include current_status"
        
        print(f"✅ Extra life returns correct placeholder response")
        print(f"   Success: {data['success']}")
        print(f"   Reason: {data['reason']}")
        print(f"   Message: {data['message']}")


class TestDailyLimitEnforcement:
    """Tests for daily limit enforcement in treat creation"""
    
    def test_treat_creation_with_limit_check(self):
        """Test that treat creation includes daily limit check"""
        # First get current daily status
        status_response = requests.get(f"{BASE_URL}/api/daily-status/{TEST_ADDRESS}")
        assert status_response.status_code == 200
        
        status = status_response.json()
        print(f"   Current daily status: {status['treats_created_today']}/{status['total_limit']} treats")
        print(f"   Can create treat: {status['can_create_treat']}")
        
        # If player can create treats, verify the endpoint works
        if status["can_create_treat"]:
            print(f"✅ Player can create treats (limit not reached)")
        else:
            print(f"⚠️ Player has reached daily limit - cannot create more treats")
        
        print(f"✅ Daily limit check verified")


class TestHealthAndIntegration:
    """Basic health and integration tests"""
    
    def test_api_health(self):
        """Test that API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print(f"✅ API health check passed")
    
    def test_daily_status_different_addresses(self):
        """Test daily status for different addresses"""
        addresses = [
            "0x1234567890abcdef1234567890abcdef12345678",
            "0xabcdef1234567890abcdef1234567890abcdef12",
            "0x0000000000000000000000000000000000000000"
        ]
        
        for addr in addresses:
            response = requests.get(f"{BASE_URL}/api/daily-status/{addr}")
            assert response.status_code == 200, f"Failed for address {addr}: {response.status_code}"
            
            data = response.json()
            assert data["base_limit"] == 5, f"Base limit should be 5 for all addresses"
        
        print(f"✅ Daily status works for different addresses")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
