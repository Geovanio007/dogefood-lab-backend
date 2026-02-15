"""
Extra Life Feature API Tests
Tests for the new Extra Life feature that allows players to purchase additional
treat creations using DOGE payments. Three package options:
- Basic: 2 treats for 10 DOGE
- Standard: 4 treats for 20 DOGE
- Premium: 6 treats for 35 DOGE
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Expected package configuration
EXPECTED_PACKAGES = {
    "basic": {"id": "basic", "name": "Basic Pack", "treats": 2, "cost_doge": 10},
    "standard": {"id": "standard", "name": "Standard Pack", "treats": 4, "cost_doge": 20},
    "premium": {"id": "premium", "name": "Premium Pack", "treats": 6, "cost_doge": 35}
}

EXPECTED_PAYMENT_ADDRESS = "DMxBXyfQbkCoZJyFoKMksjn9epLTwhHAyE"


class TestExtraLifePackages:
    """Tests for GET /api/extra-life/packages endpoint"""
    
    def test_get_packages_success(self):
        """Packages endpoint returns 200 with correct package configuration"""
        response = requests.get(f"{BASE_URL}/api/extra-life/packages")
        assert response.status_code == 200
        
        data = response.json()
        # Verify structure
        assert "packages" in data
        assert "payment_address" in data
        assert "required_confirmations" in data
        
        # Verify payment address
        assert data["payment_address"] == EXPECTED_PAYMENT_ADDRESS
        
        # Verify packages
        packages = data["packages"]
        assert len(packages) == 3
        
        # Convert to dict for easier verification
        packages_dict = {p["id"]: p for p in packages}
        
        # Verify Basic package
        assert "basic" in packages_dict
        basic = packages_dict["basic"]
        assert basic["name"] == "Basic Pack"
        assert basic["treats"] == 2
        assert basic["cost_doge"] == 10
        
        # Verify Standard package
        assert "standard" in packages_dict
        standard = packages_dict["standard"]
        assert standard["name"] == "Standard Pack"
        assert standard["treats"] == 4
        assert standard["cost_doge"] == 20
        
        # Verify Premium package
        assert "premium" in packages_dict
        premium = packages_dict["premium"]
        assert premium["name"] == "Premium Pack"
        assert premium["treats"] == 6
        assert premium["cost_doge"] == 35
        
        print(f"✓ All 3 packages verified with correct pricing")


class TestExtraLifeCreate:
    """Tests for POST /api/extra-life/create endpoint"""
    
    @pytest.fixture
    def test_address(self):
        """Generate unique test address for each test"""
        return f"TEST_extralife_{uuid.uuid4().hex[:16]}"
    
    def test_create_purchase_basic_package(self, test_address):
        """Create purchase for basic package returns pending purchase"""
        payload = {
            "player_address": test_address,
            "package_id": "basic"
        }
        response = requests.post(
            f"{BASE_URL}/api/extra-life/create",
            json=payload
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify structure
        assert "purchase" in data
        assert "existing" in data
        assert "payment_address" in data
        
        # Verify purchase details
        purchase = data["purchase"]
        assert purchase["player_address"] == test_address
        assert purchase["package_id"] == "basic"
        assert purchase["package_name"] == "Basic Pack"
        assert purchase["treats_amount"] == 2
        assert purchase["cost_doge"] == 10
        assert purchase["status"] == "pending"
        assert purchase["payment_confirmed"] == False
        assert "id" in purchase
        
        # Verify payment address
        assert data["payment_address"] == EXPECTED_PAYMENT_ADDRESS
        assert data["existing"] == False
        
        print(f"✓ Basic package purchase created: {purchase['id']}")
    
    def test_create_purchase_standard_package(self, test_address):
        """Create purchase for standard package returns pending purchase"""
        payload = {
            "player_address": test_address,
            "package_id": "standard"
        }
        response = requests.post(
            f"{BASE_URL}/api/extra-life/create",
            json=payload
        )
        assert response.status_code == 200
        
        data = response.json()
        purchase = data["purchase"]
        assert purchase["package_id"] == "standard"
        assert purchase["package_name"] == "Standard Pack"
        assert purchase["treats_amount"] == 4
        assert purchase["cost_doge"] == 20
        
        print(f"✓ Standard package purchase created: {purchase['id']}")
    
    def test_create_purchase_premium_package(self, test_address):
        """Create purchase for premium package returns pending purchase"""
        payload = {
            "player_address": test_address,
            "package_id": "premium"
        }
        response = requests.post(
            f"{BASE_URL}/api/extra-life/create",
            json=payload
        )
        assert response.status_code == 200
        
        data = response.json()
        purchase = data["purchase"]
        assert purchase["package_id"] == "premium"
        assert purchase["package_name"] == "Premium Pack"
        assert purchase["treats_amount"] == 6
        assert purchase["cost_doge"] == 35
        
        print(f"✓ Premium package purchase created: {purchase['id']}")
    
    def test_create_purchase_invalid_package(self, test_address):
        """Create purchase with invalid package ID returns 400"""
        payload = {
            "player_address": test_address,
            "package_id": "invalid_package"
        }
        response = requests.post(
            f"{BASE_URL}/api/extra-life/create",
            json=payload
        )
        assert response.status_code == 400
        assert "Invalid package ID" in response.json()["detail"]
        
        print("✓ Invalid package ID correctly rejected")
    
    def test_create_purchase_returns_existing(self, test_address):
        """Creating purchase twice returns existing pending purchase"""
        payload = {
            "player_address": test_address,
            "package_id": "basic"
        }
        
        # Create first purchase
        response1 = requests.post(
            f"{BASE_URL}/api/extra-life/create",
            json=payload
        )
        assert response1.status_code == 200
        purchase_id1 = response1.json()["purchase"]["id"]
        
        # Try to create second purchase
        response2 = requests.post(
            f"{BASE_URL}/api/extra-life/create",
            json=payload
        )
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Should return existing purchase with flag
        assert data2["purchase"]["id"] == purchase_id1
        assert data2["existing"] == True
        
        print(f"✓ Existing purchase correctly returned: {purchase_id1}")


class TestExtraLifeStatus:
    """Tests for GET /api/extra-life/status/{player_address} endpoint"""
    
    @pytest.fixture
    def test_address(self):
        return f"TEST_extralife_status_{uuid.uuid4().hex[:16]}"
    
    def test_get_status_no_purchases(self, test_address):
        """Get status for player with no purchases"""
        response = requests.get(f"{BASE_URL}/api/extra-life/status/{test_address}")
        assert response.status_code == 200
        
        data = response.json()
        # Verify structure
        assert "extra_treats_balance" in data
        assert "pending_purchase" in data
        assert "purchase_history" in data
        assert "packages" in data
        assert "payment_address" in data
        
        # Verify values for new player
        assert data["extra_treats_balance"] == 0
        assert data["pending_purchase"] is None
        assert data["purchase_history"] == []
        assert len(data["packages"]) == 3
        assert data["payment_address"] == EXPECTED_PAYMENT_ADDRESS
        
        print("✓ Status for new player correctly returned")
    
    def test_get_status_with_pending_purchase(self, test_address):
        """Get status shows pending purchase after creation"""
        # Create a purchase
        create_response = requests.post(
            f"{BASE_URL}/api/extra-life/create",
            json={
                "player_address": test_address,
                "package_id": "standard"
            }
        )
        assert create_response.status_code == 200
        purchase_id = create_response.json()["purchase"]["id"]
        
        # Get status
        status_response = requests.get(f"{BASE_URL}/api/extra-life/status/{test_address}")
        assert status_response.status_code == 200
        
        data = status_response.json()
        assert data["pending_purchase"] is not None
        assert data["pending_purchase"]["id"] == purchase_id
        assert data["pending_purchase"]["package_id"] == "standard"
        assert data["pending_purchase"]["status"] == "pending"
        
        print(f"✓ Pending purchase shown in status: {purchase_id}")


class TestExtraLifeVerifyPayment:
    """Tests for POST /api/extra-life/verify-payment endpoint"""
    
    @pytest.fixture
    def test_address(self):
        return f"TEST_extralife_verify_{uuid.uuid4().hex[:16]}"
    
    def test_verify_payment_invalid_purchase_id(self):
        """Verify payment fails with invalid purchase ID"""
        response = requests.post(
            f"{BASE_URL}/api/extra-life/verify-payment",
            json={
                "purchase_id": "fake_purchase_id_12345",
                "tx_hash": "fake_tx_hash_abcdef123456"
            }
        )
        # Should return 404 for non-existent purchase
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
        
        print("✓ Invalid purchase ID correctly rejected with 404")
    
    def test_verify_payment_fake_tx_hash(self, test_address):
        """Verify payment handles fake transaction hash gracefully"""
        # First create a purchase
        create_response = requests.post(
            f"{BASE_URL}/api/extra-life/create",
            json={
                "player_address": test_address,
                "package_id": "basic"
            }
        )
        assert create_response.status_code == 200
        purchase_id = create_response.json()["purchase"]["id"]
        
        # Try to verify with fake tx hash
        verify_response = requests.post(
            f"{BASE_URL}/api/extra-life/verify-payment",
            json={
                "purchase_id": purchase_id,
                "tx_hash": "fake_tx_hash_that_does_not_exist_12345"
            }
        )
        
        # Should return 200 with success=False (transaction not found)
        # OR could return 400/503 if verification service fails
        assert verify_response.status_code in [200, 400, 503]
        
        data = verify_response.json()
        if verify_response.status_code == 200:
            # If 200, should indicate transaction not found
            assert data.get("success") == False or data.get("is_confirmed") == False
            print(f"✓ Fake tx hash handled gracefully: {data.get('message', 'Transaction not found')}")
        else:
            # If error status, should have meaningful error
            print(f"✓ Fake tx hash returned error: {data.get('detail', 'Error')}")


class TestExtraLifeCancel:
    """Tests for DELETE /api/extra-life/cancel/{purchase_id} endpoint"""
    
    @pytest.fixture
    def test_address(self):
        return f"TEST_extralife_cancel_{uuid.uuid4().hex[:16]}"
    
    def test_cancel_pending_purchase(self, test_address):
        """Cancel pending purchase succeeds"""
        # Create a purchase
        create_response = requests.post(
            f"{BASE_URL}/api/extra-life/create",
            json={
                "player_address": test_address,
                "package_id": "basic"
            }
        )
        assert create_response.status_code == 200
        purchase_id = create_response.json()["purchase"]["id"]
        
        # Cancel the purchase
        cancel_response = requests.delete(
            f"{BASE_URL}/api/extra-life/cancel/{purchase_id}",
            params={"player_address": test_address}
        )
        assert cancel_response.status_code == 200
        
        data = cancel_response.json()
        assert data["success"] == True
        assert "cancelled" in data["message"].lower()
        
        print(f"✓ Purchase cancelled successfully: {purchase_id}")
    
    def test_cancel_nonexistent_purchase(self, test_address):
        """Cancel non-existent purchase returns 404"""
        cancel_response = requests.delete(
            f"{BASE_URL}/api/extra-life/cancel/fake_purchase_id_12345",
            params={"player_address": test_address}
        )
        assert cancel_response.status_code == 404
        
        print("✓ Non-existent purchase correctly returns 404")
    
    def test_cancel_wrong_player(self, test_address):
        """Cancel purchase with wrong player address fails"""
        # Create a purchase
        create_response = requests.post(
            f"{BASE_URL}/api/extra-life/create",
            json={
                "player_address": test_address,
                "package_id": "basic"
            }
        )
        assert create_response.status_code == 200
        purchase_id = create_response.json()["purchase"]["id"]
        
        # Try to cancel with different player address
        cancel_response = requests.delete(
            f"{BASE_URL}/api/extra-life/cancel/{purchase_id}",
            params={"player_address": "wrong_player_address"}
        )
        assert cancel_response.status_code == 404
        
        print("✓ Cancel with wrong player address correctly rejected")


class TestDailyStatusWithExtraLife:
    """Tests for GET /api/daily-status/{address} with extra life info"""
    
    @pytest.fixture
    def test_address(self):
        return f"TEST_dailystatus_{uuid.uuid4().hex[:16]}"
    
    def test_daily_status_includes_extra_life_packages(self, test_address):
        """Daily status includes extra_life_packages and payment_address"""
        response = requests.get(f"{BASE_URL}/api/daily-status/{test_address}")
        assert response.status_code == 200
        
        data = response.json()
        # Verify extra life info is included
        assert "extra_life_packages" in data
        assert "payment_address" in data
        
        # Verify packages
        packages = data["extra_life_packages"]
        assert len(packages) == 3
        
        # Verify payment address
        assert data["payment_address"] == EXPECTED_PAYMENT_ADDRESS
        
        # Verify other daily status fields still present
        assert "treats_in_window" in data
        assert "remaining_treats" in data
        assert "can_create_treat" in data
        
        print("✓ Daily status includes extra life packages and payment address")


class TestDebugEndpointSecurity:
    """Tests for debug endpoint security"""
    
    def test_debug_subscriptions_requires_admin_secret(self):
        """Debug subscriptions endpoint requires admin_secret parameter"""
        # Try without admin_secret
        response = requests.get(f"{BASE_URL}/api/auto-mixer/debug-subscriptions")
        # Should return 422 (validation error - missing required param) or 403 (forbidden)
        assert response.status_code in [422, 403]
        
        print("✓ Debug endpoint correctly requires admin_secret parameter")
    
    def test_debug_subscriptions_rejects_invalid_secret(self):
        """Debug subscriptions endpoint rejects invalid admin_secret"""
        response = requests.get(
            f"{BASE_URL}/api/auto-mixer/debug-subscriptions",
            params={"admin_secret": "wrong_secret_12345"}
        )
        assert response.status_code == 403
        assert "Unauthorized" in response.json()["detail"]
        
        print("✓ Debug endpoint correctly rejects invalid admin_secret")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
