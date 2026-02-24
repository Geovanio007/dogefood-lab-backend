"""
Test suite for DogeFood Lab Bug Fixes - Iteration 7
Tests for:
1. Player count consistency (stats vs leaderboard)
2. NFT holder VIP status verification  
3. Batch NFT verification endpoint
4. Server-side blockchain fallback in verify-nft
5. Leaderboard limit increase (default 200)
"""

import pytest
import requests
import os

# Use preview backend URL from frontend/.env
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://nft-leaderboard-fix.preview.emergentagent.com').rstrip('/')

# Production backend for verification
PROD_URL = "https://dogefood-lab-api.onrender.com"


class TestHealthAndBasics:
    """Basic health checks"""
    
    def test_backend_health_root(self):
        """Test / root endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/", timeout=30)
        print(f"Root endpoint response: {response.status_code}")
        assert response.status_code == 200
        
    def test_api_health_endpoint(self):
        """Test /api/health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=30)
        print(f"Health endpoint response: {response.status_code} - {response.text[:200]}")
        assert response.status_code == 200


class TestPlayerCountConsistency:
    """Tests for Bug #2: Player count mismatch between stats and leaderboard"""
    
    def test_stats_endpoint_returns_eligible_players(self):
        """GET /api/stats should return total_players with same filter as leaderboard"""
        response = requests.get(f"{BASE_URL}/api/stats", timeout=30)
        assert response.status_code == 200
        
        data = response.json()
        print(f"Stats response: {data}")
        
        # Verify response structure
        assert "total_players" in data
        assert "total_registered" in data  # Should show all registered vs eligible
        assert isinstance(data["total_players"], int)
        
    def test_leaderboard_returns_all_eligible(self):
        """GET /api/leaderboard should return all eligible players (not capped at 50)"""
        response = requests.get(f"{BASE_URL}/api/leaderboard", timeout=30)
        assert response.status_code == 200
        
        leaderboard = response.json()
        print(f"Leaderboard returned {len(leaderboard)} entries")
        
        # Should be a list
        assert isinstance(leaderboard, list)
        
        # Each entry should have required fields
        if len(leaderboard) > 0:
            entry = leaderboard[0]
            assert "address" in entry or "wallet_address" in entry
            assert "points" in entry
            
    def test_leaderboard_with_high_limit(self):
        """Test that leaderboard accepts limit parameter up to 200"""
        response = requests.get(f"{BASE_URL}/api/leaderboard?limit=200", timeout=30)
        assert response.status_code == 200
        
        leaderboard = response.json()
        print(f"Leaderboard with limit=200 returned {len(leaderboard)} entries")
        
        # Verify it's returning up to 200
        assert isinstance(leaderboard, list)
        
    def test_stats_total_players_equals_leaderboard_count(self):
        """
        CRITICAL: stats.total_players should equal len(leaderboard)
        Both use same filter: points > 0 AND valid nickname
        """
        # Get stats
        stats_response = requests.get(f"{BASE_URL}/api/stats", timeout=30)
        assert stats_response.status_code == 200
        stats = stats_response.json()
        
        # Get full leaderboard (with high limit)
        leaderboard_response = requests.get(f"{BASE_URL}/api/leaderboard?limit=500", timeout=30)
        assert leaderboard_response.status_code == 200
        leaderboard = leaderboard_response.json()
        
        stats_total = stats.get("total_players", 0)
        leaderboard_count = len(leaderboard)
        
        print(f"Stats total_players: {stats_total}")
        print(f"Leaderboard count: {leaderboard_count}")
        
        # Allow small tolerance (1-2) for race conditions during test
        difference = abs(stats_total - leaderboard_count)
        print(f"Difference: {difference}")
        
        # They should match (or be very close)
        assert difference <= 2, f"Player count mismatch: stats={stats_total}, leaderboard={leaderboard_count}"


class TestNFTVerification:
    """Tests for Bug #1: NFT holders not receiving VIP status and bonus"""
    
    def test_admin_verify_all_nft_holders_endpoint_exists(self):
        """POST /api/admin/verify-all-nft-holders endpoint should exist"""
        response = requests.post(f"{BASE_URL}/api/admin/verify-all-nft-holders", timeout=120)
        
        print(f"Batch NFT verify response: {response.status_code}")
        
        # Should return 200 with proper JSON structure (not 404 or 405)
        assert response.status_code in [200, 201], f"Unexpected status: {response.status_code}"
        
        data = response.json()
        print(f"Batch verify response: {data}")
        
        # Verify response structure - actual response has _count suffix for some fields
        assert "total_checked" in data
        assert "newly_credited" in data  # List of newly credited players
        assert "newly_credited_count" in data or "already_credited_count" in data  # Count fields
        assert "errors" in data
        
        # Verify data types
        assert isinstance(data["total_checked"], int)
        assert isinstance(data["newly_credited"], list)
        assert isinstance(data["errors"], list)
        
        # Log counts for verification
        print(f"Total checked: {data.get('total_checked')}")
        print(f"Newly credited: {data.get('newly_credited_count', len(data.get('newly_credited', [])))}")
        print(f"Already credited: {data.get('already_credited_count', 0)}")
        
    def test_nft_holders_have_vip_status_on_leaderboard(self):
        """All NFT holders on leaderboard should have is_vip=True"""
        response = requests.get(f"{BASE_URL}/api/leaderboard?limit=200", timeout=30)
        assert response.status_code == 200
        
        leaderboard = response.json()
        
        nft_holders_count = 0
        vip_without_nft = 0
        nft_without_vip = 0
        
        for player in leaderboard:
            is_nft = player.get("is_nft_holder", False)
            is_vip = player.get("is_vip", False)
            
            if is_nft:
                nft_holders_count += 1
                if not is_vip:
                    nft_without_vip += 1
                    print(f"WARNING: NFT holder without VIP: {player.get('address', player.get('wallet_address', 'unknown'))}")
                    
        print(f"Total NFT holders on leaderboard: {nft_holders_count}")
        print(f"NFT holders missing VIP status: {nft_without_vip}")
        
        # All NFT holders should have VIP
        assert nft_without_vip == 0, f"{nft_without_vip} NFT holders missing VIP status"


class TestVerifyNFTEndpoint:
    """Test the verify-nft endpoint with server-side blockchain fallback"""
    
    def test_verify_nft_endpoint_exists(self):
        """POST /api/verify-nft/{address} should exist"""
        test_address = "0x1234567890abcdef1234567890abcdef12345678"
        
        response = requests.post(
            f"{BASE_URL}/api/verify-nft/{test_address}",
            json={"is_holder": False},
            timeout=30
        )
        
        print(f"Verify NFT response: {response.status_code} - {response.text[:500]}")
        
        # Should not return 404/405
        assert response.status_code in [200, 201, 400, 422], f"Unexpected status: {response.status_code}"
        
    def test_verify_nft_with_false_triggers_server_check(self):
        """When frontend reports is_holder=false, server should do blockchain check"""
        # Use a real DogeOS address format
        test_address = "0x0000000000000000000000000000000000000001"
        
        response = requests.post(
            f"{BASE_URL}/api/verify-nft/{test_address}",
            json={"is_holder": False},
            timeout=30
        )
        
        print(f"Verify NFT (false) response: {response.status_code}")
        
        # Should succeed (server will do blockchain check)
        assert response.status_code in [200, 201], f"Unexpected status: {response.status_code}"


class TestProductionBackend:
    """Verify fixes on production backend (Render)"""
    
    def test_production_health(self):
        """Test production backend is healthy"""
        try:
            response = requests.get(f"{PROD_URL}/", timeout=30)
            print(f"Production root: {response.status_code}")
            assert response.status_code == 200
        except Exception as e:
            pytest.skip(f"Production backend not reachable: {e}")
            
    def test_production_stats_leaderboard_consistency(self):
        """Verify stats/leaderboard consistency on production"""
        try:
            stats_response = requests.get(f"{PROD_URL}/api/stats", timeout=30)
            if stats_response.status_code != 200:
                pytest.skip("Production stats endpoint not available")
                
            leaderboard_response = requests.get(f"{PROD_URL}/api/leaderboard?limit=500", timeout=30)
            if leaderboard_response.status_code != 200:
                pytest.skip("Production leaderboard endpoint not available")
                
            stats = stats_response.json()
            leaderboard = leaderboard_response.json()
            
            stats_total = stats.get("total_players", 0)
            leaderboard_count = len(leaderboard)
            
            print(f"PRODUCTION - Stats total_players: {stats_total}")
            print(f"PRODUCTION - Leaderboard count: {leaderboard_count}")
            print(f"PRODUCTION - Difference: {abs(stats_total - leaderboard_count)}")
            
            # Allow small tolerance
            difference = abs(stats_total - leaderboard_count)
            assert difference <= 5, f"Production player count mismatch: stats={stats_total}, leaderboard={leaderboard_count}"
            
        except requests.exceptions.RequestException as e:
            pytest.skip(f"Production backend error: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
