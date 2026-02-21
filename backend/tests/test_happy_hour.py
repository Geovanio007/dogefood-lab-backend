"""
Happy Hour Feature Tests - DogeFood Lab
Tests for the Happy Hour feature that provides +25% bonus points on all treats collected
during 15:00-16:00 UTC daily.

Test Coverage:
- GET /api/happy-hour/status endpoint
- Happy Hour bonus application in treat collection
- Status response structure validation
"""

import pytest
import requests
import os
from datetime import datetime, timezone

# API Base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHappyHourStatus:
    """Tests for the Happy Hour status endpoint"""
    
    def test_happy_hour_status_endpoint_returns_200(self):
        """Test that the happy hour status endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/happy-hour/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✅ Happy Hour status endpoint returns 200")
    
    def test_happy_hour_status_structure_when_inactive(self):
        """Test the response structure when Happy Hour is NOT active"""
        response = requests.get(f"{BASE_URL}/api/happy-hour/status")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required fields exist
        assert "active" in data, "Missing 'active' field"
        assert "bonus_percent" in data, "Missing 'bonus_percent' field"
        assert "start_hour_utc" in data, "Missing 'start_hour_utc' field"
        assert "duration_minutes" in data, "Missing 'duration_minutes' field"
        assert "message" in data, "Missing 'message' field"
        
        # Verify bonus percent is 25%
        assert data["bonus_percent"] == 25, f"Expected 25% bonus, got {data['bonus_percent']}%"
        
        # Verify start hour is 15:00 UTC
        assert data["start_hour_utc"] == 15, f"Expected start at 15:00 UTC, got {data['start_hour_utc']}"
        
        # Verify duration is 60 minutes
        assert data["duration_minutes"] == 60, f"Expected 60 min duration, got {data['duration_minutes']}"
        
        print(f"✅ Happy Hour status structure verified: active={data['active']}, bonus={data['bonus_percent']}%")
        print(f"   Start hour: {data['start_hour_utc']}:00 UTC, Duration: {data['duration_minutes']} min")
        print(f"   Message: {data['message']}")
    
    def test_happy_hour_inactive_has_countdown(self):
        """When inactive, response should include seconds_until_next"""
        response = requests.get(f"{BASE_URL}/api/happy-hour/status")
        assert response.status_code == 200
        
        data = response.json()
        
        # If not active, should have countdown fields
        if not data.get("active"):
            assert "seconds_until_next" in data, "Missing 'seconds_until_next' when inactive"
            assert "next_start_utc" in data, "Missing 'next_start_utc' when inactive"
            
            # Validate seconds_until_next is reasonable (0 - 86400 seconds = 24 hours)
            seconds = data["seconds_until_next"]
            assert 0 <= seconds <= 86400, f"seconds_until_next out of range: {seconds}"
            
            print(f"✅ Happy Hour countdown verified: {seconds} seconds until next ({seconds//3600}h {(seconds%3600)//60}m)")
            print(f"   Next start: {data['next_start_utc']}")
        else:
            # If active, should have remaining_seconds
            assert "remaining_seconds" in data, "Missing 'remaining_seconds' when active"
            print(f"✅ Happy Hour is ACTIVE: {data['remaining_seconds']} seconds remaining")
    
    def test_happy_hour_status_data_types(self):
        """Verify correct data types in the response"""
        response = requests.get(f"{BASE_URL}/api/happy-hour/status")
        data = response.json()
        
        assert isinstance(data["active"], bool), "active should be boolean"
        assert isinstance(data["bonus_percent"], int), "bonus_percent should be int"
        assert isinstance(data["start_hour_utc"], int), "start_hour_utc should be int"
        assert isinstance(data["duration_minutes"], int), "duration_minutes should be int"
        assert isinstance(data["message"], str), "message should be string"
        
        print("✅ Happy Hour status data types verified")


class TestBackendHealth:
    """Backend health check tests"""
    
    def test_api_health_endpoint(self):
        """Test the /api/health endpoint returns proper JSON"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data, "Missing 'status' field"
        assert data["status"] == "healthy", f"Expected healthy status, got {data['status']}"
        
        print(f"✅ Backend health check passed: {data}")


class TestTreatCollectionEndpoint:
    """Tests for the treat collection endpoint structure"""
    
    def test_collect_treat_endpoint_exists(self):
        """Verify the collect treat endpoint exists (returns proper error for invalid request)"""
        # Send a request without valid data - should get 400 (bad request) not 404 (not found)
        response = requests.post(f"{BASE_URL}/api/treats/invalid_treat_id/collect", json={})
        
        # Should return 400 (player_address required) or 404 (treat not found), not 405 or 500
        assert response.status_code in [400, 404, 422], f"Unexpected status: {response.status_code}"
        print(f"✅ Treat collection endpoint exists, returned {response.status_code} for invalid request")
    
    def test_collect_treat_requires_player_address(self):
        """Verify the endpoint requires player_address"""
        response = requests.post(f"{BASE_URL}/api/treats/test_treat_id/collect", json={})
        
        # Should return 400 or 422 for missing player_address
        if response.status_code == 400:
            data = response.json()
            assert "player address" in data.get("detail", "").lower() or "player_address" in str(data), \
                "Error message should mention player address requirement"
            print("✅ Treat collection endpoint correctly requires player_address")


class TestSparklesRemoval:
    """Verify Sparkles icon has been removed from frontend"""
    
    def test_no_sparkles_import(self):
        """Grep test for Sparkles import in frontend - should find none"""
        import subprocess
        
        result = subprocess.run(
            ["grep", "-r", "Sparkles", "/app/frontend/src/"],
            capture_output=True,
            text=True
        )
        
        # Return code 1 means no matches found (which is what we want)
        # Return code 0 means matches found (failure)
        assert result.returncode == 1, f"Found Sparkles imports: {result.stdout}"
        print("✅ No Sparkles icon imports found in frontend code")


class TestFrontendBuild:
    """Frontend build and load tests"""
    
    def test_frontend_loads(self):
        """Test that frontend loads without errors"""
        response = requests.get(BASE_URL)
        assert response.status_code == 200, f"Frontend failed to load: {response.status_code}"
        
        # Verify it returns HTML
        content_type = response.headers.get("content-type", "")
        assert "text/html" in content_type, f"Expected HTML, got {content_type}"
        
        # Verify React app root exists
        assert '<div id="root">' in response.text or "root" in response.text, "React root element not found"
        
        print("✅ Frontend loads successfully")


# Additional integration test
class TestHappyHourIntegration:
    """Integration tests for Happy Hour with current UTC time"""
    
    def test_happy_hour_reflects_current_time(self):
        """Verify Happy Hour status matches current UTC time"""
        response = requests.get(f"{BASE_URL}/api/happy-hour/status")
        data = response.json()
        
        # Get current UTC time
        now = datetime.now(timezone.utc)
        
        # Happy Hour runs 15:00-16:00 UTC
        is_happy_hour_time = now.hour == 15 and now.minute < 60
        
        if is_happy_hour_time:
            assert data["active"] == True, "Should be active during 15:00-16:00 UTC"
            print(f"✅ Happy Hour correctly shows ACTIVE at {now.strftime('%H:%M UTC')}")
        else:
            assert data["active"] == False, f"Should be inactive outside 15:00-16:00 UTC (current: {now.hour}:00)"
            print(f"✅ Happy Hour correctly shows INACTIVE at {now.strftime('%H:%M UTC')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
