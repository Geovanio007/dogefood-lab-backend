import requests
import sys
from datetime import datetime
import json
import time

class DogeLabAPITester:
    def __init__(self, base_url="https://web3-lab-game.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        # Using realistic wallet addresses for Phase 2 testing
        self.test_player_address = "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54"
        self.test_player_address_2 = "0x8ba1f109551bD432803012645Hac136c0c6160"
        self.test_player_address_3 = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
        self.test_treat_id = None
        self.missing_features = []
        self.season_id = 1

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

    def test_create_player_with_nickname(self):
        """Test player creation with nickname (Enhanced Feature)"""
        player_data = {
            "address": self.test_player_address,
            "nickname": "DogeScientist",
            "is_nft_holder": True
        }
        success, response = self.run_test("Create Player with Nickname", "POST", "player", 200, data=player_data)
        
        # Check if nickname is supported
        if success and 'nickname' not in response:
            self.missing_features.append("Player nickname support")
            print("   ⚠️  Note: Nickname field not supported in current implementation")
        
        return success, response

    def test_create_enhanced_treat(self):
        """Test creating enhanced treat with main ingredient and timer info"""
        treat_data = {
            "name": "Premium Bacon Delight",
            "creator_address": self.test_player_address,
            "ingredients": ["premium_bacon", "aged_cheese", "organic_herbs"],
            "main_ingredient": "premium_bacon",  # Enhanced feature
            "rarity": "legendary",
            "flavor": "savory",
            "image": "premium-treat-image-url",
            "timer_duration": 10800,  # 3 hours in seconds
            "brewing_status": "brewing"  # Enhanced feature
        }
        success, response = self.run_test("Create Enhanced Treat", "POST", "treats", 200, data=treat_data)
        
        # Check for enhanced features
        if success:
            if 'main_ingredient' not in response:
                self.missing_features.append("Treat main_ingredient field")
                print("   ⚠️  Note: main_ingredient field not supported")
            if 'timer_duration' not in response:
                self.missing_features.append("Treat timer system")
                print("   ⚠️  Note: Timer system not implemented")
            if 'brewing_status' not in response:
                self.missing_features.append("Treat brewing status")
                print("   ⚠️  Note: Brewing status not supported")
            
            if 'id' in response:
                self.test_treat_id = response['id']
        
        return success, response

    def test_timer_system_support(self):
        """Test timer system functionality"""
        # Test getting treats with timer info
        success, response = self.run_test("Get Treats with Timer Info", "GET", f"treats/{self.test_player_address}", 200)
        
        if success and response:
            has_timer_fields = any('timer_duration' in treat or 'brewing_status' in treat for treat in response)
            if not has_timer_fields:
                self.missing_features.append("Timer system in treat retrieval")
                print("   ⚠️  Note: Timer fields not present in treat responses")
        
        return success, response

    def test_check_timer_endpoint(self):
        """Test the check timer endpoint for treats"""
        if not self.test_treat_id:
            print("   ⚠️  No treat ID available for timer testing")
            return False, {}
        
        return self.run_test("Check Treat Timer", "POST", f"treats/{self.test_treat_id}/check-timer", 200)

    def test_brewing_treats_endpoint(self):
        """Test getting brewing treats for a player"""
        return self.run_test("Get Brewing Treats", "GET", f"treats/{self.test_player_address}/brewing", 200)

    def test_leaderboard_with_nicknames(self):
        """Test leaderboard returns nicknames"""
        success, response = self.run_test("Get Leaderboard with Nicknames", "GET", "leaderboard", 200, params={"limit": 10})
        
        if success and response:
            has_nicknames = any('nickname' in entry for entry in response)
            if not has_nicknames:
                self.missing_features.append("Leaderboard nickname support")
                print("   ⚠️  Note: Leaderboard doesn't include player nicknames")
        
        return success, response

    def test_multiple_wallet_addresses(self):
        """Test with multiple realistic wallet addresses"""
        test_addresses = [
            "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54",
            "0x8ba1f109551bD432803012645Hac136c0c6160",
            "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
        ]
        
        all_success = True
        for i, address in enumerate(test_addresses):
            player_data = {
                "address": address,
                "is_nft_holder": i % 2 == 0  # Alternate NFT holder status
            }
            success, _ = self.run_test(f"Create Player {i+1}", "POST", "player", 200, data=player_data)
            if not success:
                all_success = False
        
        return all_success, {}

    def test_error_handling(self):
        """Test error handling for various scenarios"""
        print("\n🔍 Testing Error Handling Scenarios...")
        
        # Test getting non-existent player
        success, _ = self.run_test("Get Non-existent Player", "GET", "player/0xnonexistent", 404)
        
        # Test creating treat with missing fields
        invalid_treat = {"name": "Incomplete Treat"}
        success2, _ = self.run_test("Create Invalid Treat", "POST", "treats", 422, data=invalid_treat)
        
        # Test updating progress for non-existent player
        invalid_progress = {
            "address": "0xnonexistent",
            "experience": 100,
            "points": 50,
            "level": 2
        }
        success3, _ = self.run_test("Update Non-existent Player Progress", "POST", "player/progress", 404, data=invalid_progress)
        
        return success and success2 and success3, {}

    def test_realistic_game_scenario(self):
        """Test a realistic game scenario with multiple players and treats"""
        print("\n🎮 Testing Realistic Game Scenario...")
        
        # Create multiple players with different wallet addresses
        players = [
            {"address": "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54", "is_nft_holder": True},
            {"address": "0x8ba1f109551bD432803012645Hac136c0c6160", "is_nft_holder": False},
            {"address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "is_nft_holder": True}
        ]
        
        # Create treats with different rarities and ingredients
        treats = [
            {
                "name": "Legendary Wagyu Treat",
                "creator_address": "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54",
                "ingredients": ["wagyu_beef", "truffle_oil", "gold_flakes"],
                "rarity": "legendary",
                "flavor": "umami",
                "image": "legendary-treat.jpg"
            },
            {
                "name": "Common Bacon Snack",
                "creator_address": "0x8ba1f109551bD432803012645Hac136c0c6160",
                "ingredients": ["bacon", "cheese"],
                "rarity": "common",
                "flavor": "savory",
                "image": "common-treat.jpg"
            }
        ]
        
        all_success = True
        for treat in treats:
            success, _ = self.run_test(f"Create {treat['rarity']} Treat", "POST", "treats", 200, data=treat)
            if not success:
                all_success = False
        
        return all_success, {}

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

    # ========== PHASE 2: OFF-CHAIN POINTS COLLECTION SYSTEM ==========
    
    def test_points_leaderboard(self):
        """Test enhanced points-based leaderboard"""
        success, response = self.run_test("Points Leaderboard", "GET", "points/leaderboard", 200, params={"limit": 10})
        
        if success and response:
            if 'leaderboard' not in response:
                self.missing_features.append("Points leaderboard structure")
                print("   ⚠️  Note: Expected 'leaderboard' key in response")
        
        return success, response

    def test_player_points_stats(self):
        """Test detailed player points statistics"""
        success, response = self.run_test("Player Points Stats", "GET", f"points/{self.test_player_address}/stats", 200)
        
        if success and response:
            expected_keys = ['player', 'activity', 'points_breakdown']
            missing_keys = [key for key in expected_keys if key not in response]
            if missing_keys:
                self.missing_features.append(f"Player stats missing keys: {missing_keys}")
                print(f"   ⚠️  Note: Missing keys in player stats: {missing_keys}")
        
        return success, response

    def test_player_points_history(self):
        """Test player points transaction history"""
        success, response = self.run_test("Player Points History", "GET", f"points/{self.test_player_address}/history", 200, params={"days": 30})
        
        if success and response:
            if 'transactions' not in response:
                self.missing_features.append("Points history structure")
                print("   ⚠️  Note: Expected 'transactions' key in response")
        
        return success, response

    def test_daily_bonus_claim(self):
        """Test NFT holder daily bonus claiming"""
        success, response = self.run_test("Daily Bonus Claim", "POST", f"points/{self.test_player_address}/daily-bonus", 200)
        
        # Test claiming again (should fail or return 0 points)
        success2, response2 = self.run_test("Daily Bonus Claim (Duplicate)", "POST", f"points/{self.test_player_address}/daily-bonus", 400)
        
        return success and success2, response

    # ========== PHASE 2: ANTI-CHEAT SYSTEM INTEGRATION ==========
    
    def test_anti_cheat_normal_treat_creation(self):
        """Test normal treat creation passes anti-cheat validation"""
        treat_data = {
            "name": "Normal Bacon Treat",
            "creator_address": self.test_player_address_2,
            "ingredients": ["bacon", "cheese", "herbs"],
            "main_ingredient": "bacon",
            "rarity": "common",
            "flavor": "savory",
            "image": "normal-treat.jpg",
            "timer_duration": 3600,  # 1 hour - normal timer
            "brewing_status": "brewing"
        }
        
        success, response = self.run_test("Anti-cheat Normal Treat", "POST", "treats", 200, data=treat_data)
        return success, response

    def test_anti_cheat_suspicious_rapid_creation(self):
        """Test anti-cheat blocks rapid treat creation"""
        # Create multiple treats rapidly to trigger anti-cheat
        for i in range(3):
            treat_data = {
                "name": f"Rapid Treat {i+1}",
                "creator_address": self.test_player_address_3,
                "ingredients": ["bacon", "cheese"],
                "rarity": "common",
                "flavor": "savory",
                "image": f"rapid-treat-{i+1}.jpg"
            }
            
            success, response = self.run_test(f"Rapid Treat Creation {i+1}", "POST", "treats", 200 if i < 2 else 429, data=treat_data)
            
            if i < 2:  # First few should succeed
                time.sleep(1)  # Small delay between treats
        
        return True, {}

    def test_player_risk_assessment(self):
        """Test player risk score assessment"""
        success, response = self.run_test("Player Risk Assessment", "GET", f"security/player-risk/{self.test_player_address_3}", 200)
        
        if success and response:
            expected_keys = ['player_address', 'risk_score', 'risk_level']
            missing_keys = [key for key in expected_keys if key not in response]
            if missing_keys:
                self.missing_features.append(f"Risk assessment missing keys: {missing_keys}")
                print(f"   ⚠️  Note: Missing keys in risk assessment: {missing_keys}")
        
        return success, response

    def test_flagged_players_monitoring(self):
        """Test flagged players monitoring"""
        success, response = self.run_test("Flagged Players", "GET", "security/flagged-players", 200, params={"risk_level": "high"})
        
        if success and response:
            if 'flagged_players' not in response:
                self.missing_features.append("Flagged players structure")
                print("   ⚠️  Note: Expected 'flagged_players' key in response")
        
        return success, response

    # ========== PHASE 2: MERKLE TREE GENERATION ==========
    
    def test_generate_season_rewards(self):
        """Test Merkle tree generation for season rewards"""
        success, response = self.run_test("Generate Season Rewards", "POST", f"rewards/generate-season/{self.season_id}", 200, data={"reward_pool_tokens": 10000})
        
        if success and response:
            expected_keys = ['message', 'merkle_root', 'total_recipients', 'total_rewards_tokens']
            missing_keys = [key for key in expected_keys if key not in response]
            if missing_keys:
                self.missing_features.append(f"Season generation missing keys: {missing_keys}")
                print(f"   ⚠️  Note: Missing keys in season generation: {missing_keys}")
        
        return success, response

    def test_get_season_data(self):
        """Test retrieving season reward data"""
        success, response = self.run_test("Get Season Data", "GET", f"rewards/season/{self.season_id}", 200)
        
        if success and response:
            expected_keys = ['season_id', 'merkle_root', 'total_rewards', 'total_recipients']
            missing_keys = [key for key in expected_keys if key not in response]
            if missing_keys:
                self.missing_features.append(f"Season data missing keys: {missing_keys}")
                print(f"   ⚠️  Note: Missing keys in season data: {missing_keys}")
        
        return success, response

    def test_get_claim_proofs(self):
        """Test Merkle proof retrieval for reward claiming"""
        success, response = self.run_test("Get Claim Proofs", "GET", f"rewards/claim/{self.test_player_address}/{self.season_id}", 200)
        
        if success and response:
            expected_keys = ['address', 'season_id', 'amount', 'proof', 'merkle_root']
            missing_keys = [key for key in expected_keys if key not in response]
            if missing_keys:
                self.missing_features.append(f"Claim proofs missing keys: {missing_keys}")
                print(f"   ⚠️  Note: Missing keys in claim proofs: {missing_keys}")
        
        return success, response

    def test_get_all_seasons(self):
        """Test listing all reward seasons"""
        success, response = self.run_test("Get All Seasons", "GET", "rewards/seasons", 200)
        
        if success and response:
            if 'seasons' not in response:
                self.missing_features.append("Seasons list structure")
                print("   ⚠️  Note: Expected 'seasons' key in response")
        
        return success, response

    # ========== PHASE 2: BACKGROUND TASK INTEGRATION ==========
    
    def test_background_points_awarding(self):
        """Test that treat creation awards points via background tasks"""
        # Get initial points
        success1, initial_stats = self.run_test("Initial Player Stats", "GET", f"points/{self.test_player_address}/stats", 200)
        initial_points = 0
        if success1 and initial_stats and 'player' in initial_stats:
            initial_points = initial_stats['player'].get('total_points', 0)
        
        # Create a treat (should trigger background points awarding)
        treat_data = {
            "name": "Points Test Treat",
            "creator_address": self.test_player_address,
            "ingredients": ["premium_bacon", "aged_cheese", "truffle_oil"],
            "main_ingredient": "premium_bacon",
            "rarity": "legendary",
            "flavor": "umami",
            "image": "points-test-treat.jpg"
        }
        
        success2, treat_response = self.run_test("Create Treat for Points", "POST", "treats", 200, data=treat_data)
        
        # Wait a moment for background task to complete
        time.sleep(2)
        
        # Check if points were awarded
        success3, final_stats = self.run_test("Final Player Stats", "GET", f"points/{self.test_player_address}/stats", 200)
        final_points = 0
        if success3 and final_stats and 'player' in final_stats:
            final_points = final_stats['player'].get('total_points', 0)
        
        points_awarded = final_points - initial_points
        if points_awarded <= 0:
            self.missing_features.append("Background points awarding")
            print(f"   ⚠️  Note: No points awarded for treat creation (initial: {initial_points}, final: {final_points})")
        else:
            print(f"   ✅ Points awarded: {points_awarded} (initial: {initial_points}, final: {final_points})")
        
        return success1 and success2 and success3, {"points_awarded": points_awarded}

    def test_enhanced_treat_creation_integration(self):
        """Test enhanced treat creation with all Phase 2 integrations"""
        treat_data = {
            "name": "Phase 2 Integration Test Treat",
            "creator_address": self.test_player_address,
            "ingredients": ["wagyu_beef", "truffle_oil", "gold_flakes", "aged_wine"],
            "main_ingredient": "wagyu_beef",
            "rarity": "legendary",
            "flavor": "umami",
            "image": "phase2-integration-treat.jpg",
            "timer_duration": 10800,  # 3 hours
            "brewing_status": "brewing"
        }
        
        success, response = self.run_test("Phase 2 Enhanced Treat Creation", "POST", "treats", 200, data=treat_data)
        
        if success and response:
            # Verify all enhanced fields are present
            enhanced_fields = ['main_ingredient', 'timer_duration', 'brewing_status', 'ready_at']
            missing_fields = [field for field in enhanced_fields if field not in response]
            if missing_fields:
                self.missing_features.append(f"Enhanced treat fields: {missing_fields}")
                print(f"   ⚠️  Note: Missing enhanced fields: {missing_fields}")
            
            if 'id' in response:
                self.test_treat_id = response['id']
        
        return success, response

def main():
    print("🐕 Starting DogeFood Lab Phase 2 API Tests 🧪")
    print("Testing Phase 2 off-chain services: Points, Anti-cheat, Merkle Trees")
    print("=" * 70)
    
    tester = DogeLabAPITester()
    
    # Phase 2 comprehensive test sequence
    tests = [
        # Core API Health Check
        ("Health Check", tester.test_health_check),
        
        # Setup: Create test players
        ("Multiple Wallet Addresses", tester.test_multiple_wallet_addresses),
        ("Create Player with Nickname", tester.test_create_player_with_nickname),
        ("Get Player", tester.test_get_player),
        ("Verify NFT", tester.test_verify_nft),
        ("Update Player Progress", tester.test_update_player_progress),
        
        # Phase 1 Features (ensure still working)
        ("Create Enhanced Treat", tester.test_create_enhanced_treat),
        ("Timer System Support", tester.test_timer_system_support),
        ("Check Timer Endpoint", tester.test_check_timer_endpoint),
        ("Brewing Treats Endpoint", tester.test_brewing_treats_endpoint),
        ("Leaderboard with Nicknames", tester.test_leaderboard_with_nicknames),
        
        # PHASE 2: OFF-CHAIN POINTS COLLECTION SYSTEM
        ("Points Leaderboard", tester.test_points_leaderboard),
        ("Player Points Stats", tester.test_player_points_stats),
        ("Player Points History", tester.test_player_points_history),
        ("Daily Bonus Claim", tester.test_daily_bonus_claim),
        ("Background Points Awarding", tester.test_background_points_awarding),
        
        # PHASE 2: ANTI-CHEAT SYSTEM INTEGRATION
        ("Anti-cheat Normal Treat Creation", tester.test_anti_cheat_normal_treat_creation),
        ("Anti-cheat Suspicious Activity", tester.test_anti_cheat_suspicious_rapid_creation),
        ("Player Risk Assessment", tester.test_player_risk_assessment),
        ("Flagged Players Monitoring", tester.test_flagged_players_monitoring),
        
        # PHASE 2: MERKLE TREE GENERATION
        ("Generate Season Rewards", tester.test_generate_season_rewards),
        ("Get Season Data", tester.test_get_season_data),
        ("Get Claim Proofs", tester.test_get_claim_proofs),
        ("Get All Seasons", tester.test_get_all_seasons),
        
        # PHASE 2: INTEGRATION TESTING
        ("Enhanced Treat Creation Integration", tester.test_enhanced_treat_creation_integration),
        
        # Core functionality verification
        ("Get Player Treats", tester.test_get_player_treats),
        ("Get All Treats", tester.test_get_all_treats),
        ("Get Game Stats", tester.test_get_game_stats),
        ("Error Handling", tester.test_error_handling),
        ("Realistic Game Scenario", tester.test_realistic_game_scenario)
    ]
    
    # Execute all tests
    for test_name, test_func in tests:
        try:
            print(f"\n{'='*50}")
            print(f"🧪 RUNNING: {test_name}")
            print(f"{'='*50}")
            test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
    
    # Print comprehensive results
    print("\n" + "=" * 70)
    print(f"📊 PHASE 2 TEST RESULTS: {tester.tests_passed}/{tester.tests_run} tests passed")
    print("=" * 70)
    
    # Categorize results
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    
    if success_rate >= 90:
        print("🎉 EXCELLENT: Phase 2 backend is highly stable!")
    elif success_rate >= 75:
        print("✅ GOOD: Phase 2 backend is mostly functional with minor issues")
    elif success_rate >= 50:
        print("⚠️  MODERATE: Phase 2 backend has significant issues requiring attention")
    else:
        print("❌ CRITICAL: Phase 2 backend has major failures requiring immediate fixes")
    
    # Report missing Phase 2 features
    if tester.missing_features:
        print(f"\n🔍 PHASE 2 FEATURES ANALYSIS:")
        print("Missing or incomplete Phase 2 features:")
        for feature in set(tester.missing_features):
            print(f"   ❌ {feature}")
        print(f"\nTotal missing features: {len(set(tester.missing_features))}")
    else:
        print("\n✅ All Phase 2 features appear to be implemented correctly!")
    
    # Final assessment
    if tester.tests_passed == tester.tests_run and not tester.missing_features:
        print("\n🚀 PHASE 2 READY FOR PRODUCTION!")
        print("All off-chain services are working perfectly.")
        return 0
    elif success_rate >= 75:
        print(f"\n⚠️  PHASE 2 MOSTLY READY - {tester.tests_run - tester.tests_passed} tests failed")
        if tester.missing_features:
            print("Some enhanced features need completion.")
        return 1
    else:
        print(f"\n🔧 PHASE 2 NEEDS WORK - {tester.tests_run - tester.tests_passed} tests failed")
        print("Significant issues require resolution before production.")
        return 1

if __name__ == "__main__":
    sys.exit(main())