import requests
import sys
from datetime import datetime
import json

class DogeLabAPITester:
    def __init__(self, base_url="https://41edfdf8-4bc2-471b-839f-8c3798f9cd1e.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        # Using realistic wallet address as requested
        self.test_player_address = "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54"
        self.test_player_address_2 = "0x8ba1f109551bD432803012645Hac136c0c6160"
        self.test_treat_id = None
        self.missing_features = []

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test API health check"""
        return self.run_test("Health Check", "GET", "", 200)

    def test_create_player(self):
        """Test player creation"""
        player_data = {
            "address": self.test_player_address,
            "is_nft_holder": True
        }
        return self.run_test("Create Player", "POST", "player", 200, data=player_data)

    def test_get_player(self):
        """Test getting player by address"""
        return self.run_test("Get Player", "GET", f"player/{self.test_player_address}", 200)

    def test_update_player_progress(self):
        """Test updating player progress"""
        progress_data = {
            "address": self.test_player_address,
            "experience": 100,
            "points": 50,
            "level": 2
        }
        return self.run_test("Update Player Progress", "POST", "player/progress", 200, data=progress_data)

    def test_verify_nft(self):
        """Test NFT verification"""
        return self.run_test("Verify NFT", "POST", f"verify-nft/{self.test_player_address}", 200)

    def test_create_treat(self):
        """Test creating a treat"""
        treat_data = {
            "name": "Test Doge Treat",
            "creator_address": self.test_player_address,
            "ingredients": ["bacon", "cheese", "love"],
            "rarity": "rare",
            "flavor": "savory",
            "image": "test-image-url"
        }
        success, response = self.run_test("Create Treat", "POST", "treats", 200, data=treat_data)
        if success and 'id' in response:
            self.test_treat_id = response['id']
        return success, response

    def test_get_player_treats(self):
        """Test getting player's treats"""
        return self.run_test("Get Player Treats", "GET", f"treats/{self.test_player_address}", 200)

    def test_get_all_treats(self):
        """Test getting all treats"""
        return self.run_test("Get All Treats", "GET", "treats", 200, params={"limit": 10})

    def test_get_leaderboard(self):
        """Test getting leaderboard"""
        return self.run_test("Get Leaderboard", "GET", "leaderboard", 200, params={"limit": 10})

    def test_get_game_stats(self):
        """Test getting game statistics"""
        return self.run_test("Get Game Stats", "GET", "stats", 200)

def main():
    print("🐕 Starting DogeFood Lab API Tests 🧪")
    print("=" * 50)
    
    tester = DogeLabAPITester()
    
    # Test sequence
    tests = [
        ("Health Check", tester.test_health_check),
        ("Create Player", tester.test_create_player),
        ("Get Player", tester.test_get_player),
        ("Verify NFT", tester.test_verify_nft),
        ("Update Player Progress", tester.test_update_player_progress),
        ("Create Treat", tester.test_create_treat),
        ("Get Player Treats", tester.test_get_player_treats),
        ("Get All Treats", tester.test_get_all_treats),
        ("Get Leaderboard", tester.test_get_leaderboard),
        ("Get Game Stats", tester.test_get_game_stats)
    ]
    
    for test_name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed! Backend API is working correctly.")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed.")
        return 1

if __name__ == "__main__":
    sys.exit(main())