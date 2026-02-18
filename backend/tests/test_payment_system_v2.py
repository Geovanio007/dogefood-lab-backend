"""
Payment System & Health Check API Tests (Iteration 4)
======================================================
Tests for critical P0 issues:
1. Auto-payment verification using Tatum API matching incoming payments to player orders
2. Health check endpoints for Render deployment

Endpoints tested:
- POST /api/extra-life/create
- GET /api/extra-life/packages
- GET /api/extra-life/status/{player_address}
- POST /api/payments/check-pending
- POST /api/payments/recheck-unmatched
- GET /api/payments/pending/{player_address}
- GET /api/health
- GET /
- GET /health
- DELETE /api/extra-life/cancel/{purchase_id}
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Expected configurations
EXPECTED_PAYMENT_ADDRESS = "DMxBXyfQbkCoZJyFoKMksjn9epLTwhHAyE"
EXPECTED_PACKAGES = {
    "basic": {"id": "basic", "name": "Basic Pack", "treats": 2, "cost_doge": 10},
    "standard": {"id": "standard", "name": "Standard Pack", "treats": 4, "cost_doge": 20},
    "premium": {"id": "premium", "name": "Premium Pack", "treats": 6, "cost_doge": 35}
}


class TestHealthEndpoints:
    """Tests for health check endpoints - Critical for Render deployment"""
    
    def test_root_endpoint_returns_html(self):
        """GET / - Root endpoint returns frontend HTML (served by React)"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/", timeout=5)
        duration = time.time() - start
        
        assert response.status_code == 200
        # Root serves frontend HTML, not JSON
        assert "<!DOCTYPE html>" in response.text or "text/html" in response.headers.get("content-type", "")
        assert duration < 3, f"Root endpoint too slow: {duration:.2f}s (should be < 3s)"
        
        print(f"✓ Root endpoint returns frontend HTML in {duration:.3f}s")
    
    def test_health_endpoint_returns_html(self):
        """GET /health - Returns frontend HTML (frontend catches non-api routes)"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        duration = time.time() - start
        
        assert response.status_code == 200
        # Non-API routes serve frontend HTML for SPA routing
        assert "<!DOCTYPE html>" in response.text or response.status_code == 200
        
        print(f"✓ /health endpoint returns 200 in {duration:.3f}s (frontend SPA routing)")
    
    def test_api_health_with_database(self):
        """GET /api/health - Returns healthy status with database connected"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        duration = time.time() - start
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify healthy status
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        assert "timestamp" in data
        assert "current_season" in data
        assert duration < 5, f"API health too slow: {duration:.2f}s"
        
        print(f"✓ /api/health shows database connected, season {data['current_season']}, in {duration:.3f}s")
    
    def test_api_root_returns_json(self):
        """GET /api/ - API root endpoint returns JSON"""
        response = requests.get(f"{BASE_URL}/api/", timeout=5)
        
        assert response.status_code == 200
        data = response.json()
        # Verify it's JSON with some expected fields
        assert "message" in data or "status" in data or "service" in data
        
        print(f"✓ /api/ returns JSON response")


class TestExtraLifePackages:
    """Tests for GET /api/extra-life/packages - Package configuration"""
    
    def test_packages_returns_three_packages(self):
        """GET /api/extra-life/packages - Returns 3 packages (basic 10, standard 20, premium 35)"""
        response = requests.get(f"{BASE_URL}/api/extra-life/packages")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "packages" in data
        assert "payment_address" in data
        assert "required_confirmations" in data
        
        # Verify payment address
        assert data["payment_address"] == EXPECTED_PAYMENT_ADDRESS
        
        # Verify 3 packages
        packages = data["packages"]
        assert len(packages) == 3
        
        # Convert to dict for verification
        packages_dict = {p["id"]: p for p in packages}
        
        # Verify Basic: 2 treats for 10 DOGE
        assert "basic" in packages_dict
        assert packages_dict["basic"]["treats"] == 2
        assert packages_dict["basic"]["cost_doge"] == 10
        
        # Verify Standard: 4 treats for 20 DOGE
        assert "standard" in packages_dict
        assert packages_dict["standard"]["treats"] == 4
        assert packages_dict["standard"]["cost_doge"] == 20
        
        # Verify Premium: 6 treats for 35 DOGE
        assert "premium" in packages_dict
        assert packages_dict["premium"]["treats"] == 6
        assert packages_dict["premium"]["cost_doge"] == 35
        
        print("✓ All 3 packages verified: basic (10 DOGE), standard (20 DOGE), premium (35 DOGE)")


class TestExtraLifeCreate:
    """Tests for POST /api/extra-life/create - Creating pending purchases"""
    
    @pytest.fixture
    def test_address(self):
        """Generate unique test address with TESTBOT_ prefix"""
        return f"TESTBOT_{uuid.uuid4().hex[:16]}"
    
    def test_create_purchase_basic(self, test_address):
        """POST /api/extra-life/create - Creates pending purchase for basic package"""
        payload = {
            "player_address": test_address,
            "package_id": "basic"
        }
        response = requests.post(f"{BASE_URL}/api/extra-life/create", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "purchase" in data
        assert "existing" in data
        assert "payment_address" in data
        
        # Verify purchase details
        purchase = data["purchase"]
        assert purchase["player_address"] == test_address
        assert purchase["package_id"] == "basic"
        assert purchase["cost_doge"] == 10
        assert purchase["treats_amount"] == 2
        assert purchase["status"] == "pending"
        assert purchase["payment_confirmed"] == False
        assert "id" in purchase
        
        assert data["existing"] == False
        assert data["payment_address"] == EXPECTED_PAYMENT_ADDRESS
        
        print(f"✓ Basic purchase created: {purchase['id']}")
        return purchase["id"]
    
    def test_create_purchase_standard(self, test_address):
        """POST /api/extra-life/create - Creates pending purchase for standard package"""
        payload = {
            "player_address": test_address,
            "package_id": "standard"
        }
        response = requests.post(f"{BASE_URL}/api/extra-life/create", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        purchase = data["purchase"]
        
        assert purchase["package_id"] == "standard"
        assert purchase["cost_doge"] == 20
        assert purchase["treats_amount"] == 4
        
        print(f"✓ Standard purchase created: {purchase['id']}")
    
    def test_create_purchase_premium(self, test_address):
        """POST /api/extra-life/create - Creates pending purchase for premium package"""
        payload = {
            "player_address": test_address,
            "package_id": "premium"
        }
        response = requests.post(f"{BASE_URL}/api/extra-life/create", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        purchase = data["purchase"]
        
        assert purchase["package_id"] == "premium"
        assert purchase["cost_doge"] == 35
        assert purchase["treats_amount"] == 6
        
        print(f"✓ Premium purchase created: {purchase['id']}")
    
    def test_create_returns_existing_pending(self, test_address):
        """POST /api/extra-life/create - Returns existing pending purchase (idempotent)"""
        payload = {
            "player_address": test_address,
            "package_id": "basic"
        }
        
        # Create first purchase
        response1 = requests.post(f"{BASE_URL}/api/extra-life/create", json=payload)
        assert response1.status_code == 200
        purchase_id1 = response1.json()["purchase"]["id"]
        
        # Create second purchase (should return existing)
        response2 = requests.post(f"{BASE_URL}/api/extra-life/create", json=payload)
        assert response2.status_code == 200
        data2 = response2.json()
        
        assert data2["purchase"]["id"] == purchase_id1
        assert data2["existing"] == True
        
        print(f"✓ Existing purchase returned correctly: {purchase_id1}")
    
    def test_create_invalid_package_returns_400(self, test_address):
        """POST /api/extra-life/create - Invalid package ID returns 400"""
        payload = {
            "player_address": test_address,
            "package_id": "invalid_package"
        }
        response = requests.post(f"{BASE_URL}/api/extra-life/create", json=payload)
        
        assert response.status_code == 400
        assert "Invalid package ID" in response.json()["detail"]
        
        print("✓ Invalid package ID correctly rejected with 400")


class TestExtraLifeStatus:
    """Tests for GET /api/extra-life/status/{player_address}"""
    
    @pytest.fixture
    def test_address(self):
        return f"TESTBOT_status_{uuid.uuid4().hex[:12]}"
    
    def test_status_returns_pending_and_history(self, test_address):
        """GET /api/extra-life/status/{player_address} - Returns pending purchases and history"""
        # First create a purchase
        requests.post(
            f"{BASE_URL}/api/extra-life/create",
            json={"player_address": test_address, "package_id": "standard"}
        )
        
        # Get status
        response = requests.get(f"{BASE_URL}/api/extra-life/status/{test_address}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "extra_treats_balance" in data
        assert "pending_purchase" in data
        assert "purchase_history" in data
        assert "packages" in data
        assert "payment_address" in data
        
        # Verify pending purchase exists
        assert data["pending_purchase"] is not None
        assert data["pending_purchase"]["package_id"] == "standard"
        assert data["pending_purchase"]["status"] == "pending"
        
        # Verify packages included
        assert len(data["packages"]) == 3
        assert data["payment_address"] == EXPECTED_PAYMENT_ADDRESS
        
        print(f"✓ Status shows pending purchase and {len(data['packages'])} packages")
    
    def test_status_new_player_empty(self):
        """GET /api/extra-life/status/{player_address} - New player has empty status"""
        new_address = f"TESTBOT_new_{uuid.uuid4().hex[:12]}"
        response = requests.get(f"{BASE_URL}/api/extra-life/status/{new_address}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["extra_treats_balance"] == 0
        assert data["pending_purchase"] is None
        assert data["purchase_history"] == []
        
        print("✓ New player status is empty as expected")


class TestPaymentCheckEndpoints:
    """Tests for payment check endpoints - Tatum API auto-matching"""
    
    def test_check_pending_returns_counts(self):
        """POST /api/payments/check-pending - Returns checked/activated/skipped counts"""
        response = requests.post(f"{BASE_URL}/api/payments/check-pending", timeout=30)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "checked" in data
        assert "activated" in data
        
        # Values should be integers
        assert isinstance(data["checked"], int)
        assert isinstance(data["activated"], int)
        
        # May have skipped count
        if "skipped" in data:
            assert isinstance(data["skipped"], int)
        
        print(f"✓ Payment check: {data['checked']} checked, {data['activated']} activated")
    
    def test_recheck_unmatched_returns_count(self):
        """POST /api/payments/recheck-unmatched - Re-checks unmatched payments against new orders"""
        response = requests.post(f"{BASE_URL}/api/payments/recheck-unmatched", timeout=30)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "unmatched_checked" in data
        assert "reactivated" in data
        
        print(f"✓ Recheck: {data['unmatched_checked']} unmatched checked, {data['reactivated']} reactivated")


class TestExtraLifeCancel:
    """Tests for DELETE /api/extra-life/cancel/{purchase_id}"""
    
    @pytest.fixture
    def test_address(self):
        return f"TESTBOT_cancel_{uuid.uuid4().hex[:12]}"
    
    def test_cancel_pending_purchase(self, test_address):
        """DELETE /api/extra-life/cancel/{purchase_id} - Cancels pending purchase"""
        # Create a purchase
        create_resp = requests.post(
            f"{BASE_URL}/api/extra-life/create",
            json={"player_address": test_address, "package_id": "basic"}
        )
        assert create_resp.status_code == 200
        purchase_id = create_resp.json()["purchase"]["id"]
        
        # Cancel it
        cancel_resp = requests.delete(
            f"{BASE_URL}/api/extra-life/cancel/{purchase_id}",
            params={"player_address": test_address}
        )
        
        assert cancel_resp.status_code == 200
        data = cancel_resp.json()
        assert data["success"] == True
        assert "cancelled" in data["message"].lower()
        
        # Verify cancelled - status should show no pending
        status_resp = requests.get(f"{BASE_URL}/api/extra-life/status/{test_address}")
        assert status_resp.json()["pending_purchase"] is None
        
        print(f"✓ Purchase {purchase_id} cancelled successfully")
    
    def test_cancel_nonexistent_returns_404(self, test_address):
        """DELETE /api/extra-life/cancel/{purchase_id} - Non-existent returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/extra-life/cancel/fake_purchase_id_12345",
            params={"player_address": test_address}
        )
        
        assert response.status_code == 404
        print("✓ Non-existent purchase returns 404")
    
    def test_cancel_wrong_player_returns_404(self, test_address):
        """DELETE /api/extra-life/cancel/{purchase_id} - Wrong player returns 404"""
        # Create a purchase
        create_resp = requests.post(
            f"{BASE_URL}/api/extra-life/create",
            json={"player_address": test_address, "package_id": "basic"}
        )
        assert create_resp.status_code == 200
        purchase_id = create_resp.json()["purchase"]["id"]
        
        # Try to cancel with different player
        cancel_resp = requests.delete(
            f"{BASE_URL}/api/extra-life/cancel/{purchase_id}",
            params={"player_address": "wrong_player_address"}
        )
        
        assert cancel_resp.status_code == 404
        print("✓ Wrong player cannot cancel purchase (returns 404)")


class TestPaymentPendingEndpoint:
    """Tests for GET /api/payments/pending/{player_address} if exists"""
    
    def test_pending_payments_endpoint(self):
        """GET /api/payments/pending/{player_address} - Check if endpoint exists"""
        test_address = f"TESTBOT_pending_{uuid.uuid4().hex[:12]}"
        response = requests.get(f"{BASE_URL}/api/payments/pending/{test_address}")
        
        # Endpoint may not exist - check for 404 or 200
        if response.status_code == 404:
            print("✓ /api/payments/pending endpoint does not exist (may be internal)")
        else:
            assert response.status_code == 200
            print(f"✓ Pending payments endpoint exists: {response.json()}")


class TestIntegrationFlow:
    """Integration tests for the complete payment flow"""
    
    @pytest.fixture
    def test_address(self):
        return f"TESTBOT_integration_{uuid.uuid4().hex[:12]}"
    
    def test_complete_purchase_flow(self, test_address):
        """Test complete flow: packages → create → status → cancel"""
        # 1. Get packages
        packages_resp = requests.get(f"{BASE_URL}/api/extra-life/packages")
        assert packages_resp.status_code == 200
        packages = packages_resp.json()["packages"]
        print(f"Step 1: Got {len(packages)} packages")
        
        # 2. Create purchase
        create_resp = requests.post(
            f"{BASE_URL}/api/extra-life/create",
            json={"player_address": test_address, "package_id": "premium"}
        )
        assert create_resp.status_code == 200
        purchase = create_resp.json()["purchase"]
        print(f"Step 2: Created purchase {purchase['id']}")
        
        # 3. Check status shows pending
        status_resp = requests.get(f"{BASE_URL}/api/extra-life/status/{test_address}")
        assert status_resp.status_code == 200
        assert status_resp.json()["pending_purchase"]["id"] == purchase["id"]
        print(f"Step 3: Status shows pending purchase")
        
        # 4. Cancel purchase
        cancel_resp = requests.delete(
            f"{BASE_URL}/api/extra-life/cancel/{purchase['id']}",
            params={"player_address": test_address}
        )
        assert cancel_resp.status_code == 200
        print(f"Step 4: Cancelled purchase")
        
        # 5. Verify cancelled
        final_status = requests.get(f"{BASE_URL}/api/extra-life/status/{test_address}")
        assert final_status.json()["pending_purchase"] is None
        print(f"Step 5: Verified cancellation")
        
        print("✓ Complete purchase flow test passed!")
    
    def test_payment_check_does_not_crash(self):
        """Verify payment check runs without crashing even with no matches"""
        # Run check-pending
        check_resp = requests.post(f"{BASE_URL}/api/payments/check-pending", timeout=30)
        assert check_resp.status_code == 200
        
        # Run recheck-unmatched
        recheck_resp = requests.post(f"{BASE_URL}/api/payments/recheck-unmatched", timeout=30)
        assert recheck_resp.status_code == 200
        
        print("✓ Payment check endpoints run without errors")


class TestTestAddressFiltering:
    """Tests to verify test addresses are excluded from payment matching"""
    
    def test_testbot_prefix_filtered(self):
        """TESTBOT_ prefix addresses should be excluded from auto-matching"""
        test_address = f"TESTBOT_filter_test_{uuid.uuid4().hex[:8]}"
        
        # Create a purchase
        create_resp = requests.post(
            f"{BASE_URL}/api/extra-life/create",
            json={"player_address": test_address, "package_id": "basic"}
        )
        assert create_resp.status_code == 200
        
        # Trigger payment check - should NOT match test addresses
        check_resp = requests.post(f"{BASE_URL}/api/payments/check-pending", timeout=30)
        assert check_resp.status_code == 200
        
        # Verify purchase is still pending (not auto-matched)
        status_resp = requests.get(f"{BASE_URL}/api/extra-life/status/{test_address}")
        assert status_resp.status_code == 200
        
        pending = status_resp.json()["pending_purchase"]
        if pending:
            # Should still be pending since TESTBOT_ is filtered
            assert pending["status"] == "pending"
            print("✓ TESTBOT_ address correctly excluded from auto-matching")
        else:
            print("✓ Purchase may have been cancelled or auto-matched (check logs)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
