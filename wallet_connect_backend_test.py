#!/usr/bin/env python3
"""
Backend Test for Wallet Connect Incident Fix Validation
Testing DogeFood Lab Game Backend APIs - Focused on leaderboard smoke test

Test Requirements from Review Request:
- URL: https://gamelab-polish.preview.emergentagent.com
- Confirm PLAY NOW -> main menu -> connect-wallet-btn works (Frontend testing - NOT covered here)
- Confirm wallet modal lists MetaMask, Coinbase Wallet, WalletConnect (Frontend testing - NOT covered here) 
- Confirm no forced page reload during service worker activation (Frontend testing - NOT covered here)
- Optional API smoke: GET /api/leaderboard returns 200 (Backend testing - COVERED here)

This test will ONLY focus on the backend API validation.
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://gamelab-polish.preview.emergentagent.com/api"

class BackendTestRunner:
    def __init__(self):
        self.results = []
        self.total_tests = 0
        self.passed_tests = 0
        
    async def log_test(self, test_name, success, message="", details=None):
        """Log test result"""
        self.total_tests += 1
        if success:
            self.passed_tests += 1
            status = "✅ PASS"
        else:
            status = "❌ FAIL"
            
        print(f"{status}: {test_name}")
        if message:
            print(f"    └─ {message}")
        if details:
            print(f"    └─ Details: {details}")
        
        self.results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
    
    async def test_leaderboard_api(self, session):
        """Test GET /api/leaderboard returns 200 (smoke test)"""
        test_name = "API Smoke Test: GET /api/leaderboard"
        
        try:
            async with session.get(f"{BASE_URL}/leaderboard", timeout=10) as response:
                status = response.status
                
                if status == 200:
                    data = await response.json()
                    # Basic validation of response structure
                    if isinstance(data, list):
                        await self.log_test(
                            test_name,
                            True,
                            f"Leaderboard API returned {len(data)} entries",
                            f"Status: {status}, Response type: list"
                        )
                    else:
                        await self.log_test(
                            test_name,
                            True,
                            f"Leaderboard API returned valid response",
                            f"Status: {status}, Response type: {type(data).__name__}"
                        )
                else:
                    response_text = await response.text()
                    await self.log_test(
                        test_name,
                        False,
                        f"API returned status {status}",
                        f"Response: {response_text[:200]}..."
                    )
                    
        except asyncio.TimeoutError:
            await self.log_test(
                test_name,
                False,
                "Request timed out after 10 seconds",
                "Check if backend service is running"
            )
        except aiohttp.ClientError as e:
            await self.log_test(
                test_name,
                False,
                f"Network error: {str(e)}",
                "Check if backend URL is accessible"
            )
        except Exception as e:
            await self.log_test(
                test_name,
                False,
                f"Unexpected error: {str(e)}",
                f"Error type: {type(e).__name__}"
            )
    
    async def test_points_leaderboard_api(self, session):
        """Test GET /api/points/leaderboard returns 200 (additional smoke test)"""
        test_name = "API Smoke Test: GET /api/points/leaderboard"
        
        try:
            async with session.get(f"{BASE_URL}/points/leaderboard", timeout=10) as response:
                status = response.status
                
                if status == 200:
                    data = await response.json()
                    # Basic validation of response structure
                    if isinstance(data, dict) and "leaderboard" in data:
                        leaderboard = data["leaderboard"]
                        await self.log_test(
                            test_name,
                            True,
                            f"Points leaderboard API returned {len(leaderboard)} entries",
                            f"Status: {status}, Structure: dict with leaderboard key"
                        )
                    else:
                        await self.log_test(
                            test_name,
                            True,
                            f"Points leaderboard API returned valid response",
                            f"Status: {status}, Response type: {type(data).__name__}"
                        )
                else:
                    response_text = await response.text()
                    await self.log_test(
                        test_name,
                        False,
                        f"API returned status {status}",
                        f"Response: {response_text[:200]}..."
                    )
                    
        except asyncio.TimeoutError:
            await self.log_test(
                test_name,
                False,
                "Request timed out after 10 seconds",
                "Check if backend service is running"
            )
        except aiohttp.ClientError as e:
            await self.log_test(
                test_name,
                False,
                f"Network error: {str(e)}",
                "Check if backend URL is accessible"
            )
        except Exception as e:
            await self.log_test(
                test_name,
                False,
                f"Unexpected error: {str(e)}",
                f"Error type: {type(e).__name__}"
            )
    
    async def test_backend_health(self, session):
        """Test basic backend connectivity"""
        test_name = "Backend Connectivity Test"
        
        try:
            # Try to reach any endpoint to verify backend is accessible
            async with session.get(f"{BASE_URL}/leaderboard", timeout=5) as response:
                # Any response (even error) means backend is reachable
                await self.log_test(
                    test_name,
                    True,
                    f"Backend is reachable (status: {response.status})",
                    f"URL: {BASE_URL}"
                )
                    
        except asyncio.TimeoutError:
            await self.log_test(
                test_name,
                False,
                "Backend connection timed out",
                f"URL: {BASE_URL} - Check if service is running"
            )
        except aiohttp.ClientError as e:
            await self.log_test(
                test_name,
                False,
                f"Cannot reach backend: {str(e)}",
                f"URL: {BASE_URL}"
            )
        except Exception as e:
            await self.log_test(
                test_name,
                False,
                f"Unexpected connectivity error: {str(e)}",
                f"Error type: {type(e).__name__}"
            )
    
    async def run_all_tests(self):
        """Run all backend tests"""
        print("🧪 DogeFood Lab - Backend API Smoke Test")
        print("="*50)
        print(f"🎯 Target URL: {BASE_URL}")
        print(f"📅 Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")
        print()
        
        # Setup HTTP session with proper headers
        connector = aiohttp.TCPConnector(ssl=False)  # Disable SSL verification for testing
        timeout = aiohttp.ClientTimeout(total=30)
        
        async with aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={
                "User-Agent": "DogeFood-Lab-Backend-Test/1.0",
                "Accept": "application/json"
            }
        ) as session:
            
            # Test 1: Backend Connectivity
            await self.test_backend_health(session)
            
            # Test 2: Leaderboard API (main requirement)
            await self.test_leaderboard_api(session)
            
            # Test 3: Points Leaderboard API (additional validation)
            await self.test_points_leaderboard_api(session)
        
        # Summary
        print()
        print("📊 Test Summary")
        print("="*30)
        print(f"Total Tests: {self.total_tests}")
        print(f"Passed: {self.passed_tests}")
        print(f"Failed: {self.total_tests - self.passed_tests}")
        
        if self.passed_tests == self.total_tests:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.total_tests - self.passed_tests} test(s) failed")
            return False

async def main():
    """Main test execution"""
    runner = BackendTestRunner()
    success = await runner.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())