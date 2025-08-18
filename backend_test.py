import requests
import sys
from datetime import datetime
import json
import time

class DogeLabAPITester:
    def __init__(self, base_url="https://67aa2a1e-7467-4ffa-b648-64cb7a49ddb4.preview.emergentagent.com"):
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

    # ========== ENHANCED GAME MECHANICS TESTING (PHASE 3) ==========
    
    def test_enhanced_treat_creation_endpoint(self):
        """Test the new enhanced treat creation endpoint with game engine"""
        treat_data = {
            "creator_address": self.test_player_address,
            "ingredients": ["strawberry", "chocolate", "honey", "milk", "banana"],
            "player_level": 10
        }
        
        success, response = self.run_test("Enhanced Treat Creation", "POST", "treats/enhanced", 200, data=treat_data)
        
        if success and response:
            expected_keys = ['treat', 'outcome', 'validation', 'message']
            missing_keys = [key for key in expected_keys if key not in response]
            if missing_keys:
                self.missing_features.append(f"Enhanced treat creation missing keys: {missing_keys}")
                print(f"   ⚠️  Note: Missing keys in enhanced treat creation: {missing_keys}")
            
            # Check treat outcome details
            if 'outcome' in response:
                outcome = response['outcome']
                outcome_keys = ['rarity', 'timer_duration_seconds', 'secret_combo', 'season_id']
                missing_outcome_keys = [key for key in outcome_keys if key not in outcome]
                if missing_outcome_keys:
                    self.missing_features.append(f"Enhanced outcome missing keys: {missing_outcome_keys}")
                    print(f"   ⚠️  Note: Missing outcome keys: {missing_outcome_keys}")
        
        return success, response

    def test_rarity_distribution_simulation(self):
        """Test rarity distribution through multiple simulations"""
        simulation_data = {
            "ingredients": ["strawberry", "chocolate", "honey", "milk", "banana"],
            "player_level": 15,
            "player_address": self.test_player_address,
            "simulations": 20
        }
        
        success, response = self.run_test("Rarity Distribution Simulation", "POST", "game/simulate-outcome", 200, data=simulation_data)
        
        if success and response:
            expected_keys = ['simulations_run', 'rarity_distribution', 'sample_outcomes']
            missing_keys = [key for key in expected_keys if key not in response]
            if missing_keys:
                self.missing_features.append(f"Simulation missing keys: {missing_keys}")
                print(f"   ⚠️  Note: Missing simulation keys: {missing_keys}")
            
            # Check rarity distribution
            if 'rarity_distribution' in response:
                rarity_dist = response['rarity_distribution']
                expected_rarities = ['Common', 'Rare', 'Epic', 'Legendary']
                print(f"   📊 Rarity Distribution: {rarity_dist}")
                
                # Verify expected rarity percentages (approximately)
                total_sims = response.get('simulations_run', 0)
                if total_sims > 0:
                    legendary_pct = (rarity_dist.get('Legendary', 0) / total_sims) * 100
                    epic_pct = (rarity_dist.get('Epic', 0) / total_sims) * 100
                    rare_pct = (rarity_dist.get('Rare', 0) / total_sims) * 100
                    common_pct = (rarity_dist.get('Common', 0) / total_sims) * 100
                    
                    print(f"   📈 Percentages: Legendary {legendary_pct:.1f}%, Epic {epic_pct:.1f}%, Rare {rare_pct:.1f}%, Common {common_pct:.1f}%")
        
        return success, response

    def test_ingredient_system_endpoints(self):
        """Test ingredient system endpoints"""
        # Test getting ingredients for different levels
        success1, response1 = self.run_test("Get Level 1 Ingredients", "GET", "ingredients", 200, params={"level": 1})
        success2, response2 = self.run_test("Get Level 10 Ingredients", "GET", "ingredients", 200, params={"level": 10})
        success3, response3 = self.run_test("Get Level 25 Ingredients", "GET", "ingredients", 200, params={"level": 25})
        
        # Test ingredient stats
        success4, response4 = self.run_test("Get Ingredient Stats", "GET", "ingredients/stats", 200)
        
        if success1 and response1:
            if 'ingredients' not in response1:
                self.missing_features.append("Ingredient system structure")
                print("   ⚠️  Note: Expected 'ingredients' key in response")
            else:
                level1_count = len(response1['ingredients'])
                print(f"   📊 Level 1 ingredients available: {level1_count}")
        
        if success2 and response2:
            level10_count = len(response2.get('ingredients', []))
            print(f"   📊 Level 10 ingredients available: {level10_count}")
        
        if success3 and response3:
            level25_count = len(response3.get('ingredients', []))
            print(f"   📊 Level 25 ingredients available: {level25_count}")
            
            # Check for legendary ingredients at high level
            legendary_ingredients = [ing for ing in response3.get('ingredients', []) if ing.get('rarity') == 'legendary']
            print(f"   ✨ Legendary ingredients at level 25: {len(legendary_ingredients)}")
        
        if success4 and response4:
            expected_stats = ['total_ingredients', 'rarity_distribution', 'type_distribution']
            missing_stats = [key for key in expected_stats if key not in response4]
            if missing_stats:
                self.missing_features.append(f"Ingredient stats missing: {missing_stats}")
                print(f"   ⚠️  Note: Missing ingredient stats: {missing_stats}")
            else:
                print(f"   📊 Total ingredients in system: {response4.get('total_ingredients', 0)}")
                print(f"   📊 Rarity distribution: {response4.get('rarity_distribution', {})}")
        
        return success1 and success2 and success3 and success4, {}

    def test_ingredient_combination_analysis(self):
        """Test ingredient combination analysis"""
        # Test with different ingredient combinations
        test_combinations = [
            ["strawberry", "chocolate"],  # 2 ingredients - Common eligible
            ["strawberry", "chocolate", "honey"],  # 3 ingredients - Rare eligible  
            ["strawberry", "chocolate", "honey", "milk"],  # 4 ingredients - Epic eligible
            ["strawberry", "chocolate", "honey", "milk", "banana"],  # 5 ingredients - Legendary eligible
            ["chocolate", "honey", "milk", "strawberry"],  # Secret combo test
        ]
        
        all_success = True
        for i, ingredients in enumerate(test_combinations):
            success, response = self.run_test(f"Analyze Combination {i+1}", "POST", "ingredients/analyze", 200, data=ingredients)
            
            if success and response:
                expected_keys = ['ingredient_count', 'variety', 'compatibility', 'secret_combo', 'recommended']
                missing_keys = [key for key in expected_keys if key not in response]
                if missing_keys:
                    self.missing_features.append(f"Ingredient analysis missing: {missing_keys}")
                    print(f"   ⚠️  Note: Missing analysis keys: {missing_keys}")
                
                # Check secret combo detection
                if 'secret_combo' in response:
                    secret_combo = response['secret_combo']
                    if secret_combo.get('is_secret_combo'):
                        print(f"   🎉 Secret combo detected: {secret_combo.get('combo_name', 'Unknown')}")
                        print(f"   🎯 Bonus: +{secret_combo.get('bonus_legendary', 0)}% Legendary, +{secret_combo.get('bonus_epic', 0)}% Epic")
                
                # Check variety bonus
                if 'variety' in response:
                    variety = response['variety']
                    print(f"   🌈 Variety multiplier: {variety.get('variety_multiplier', 1.0)}x ({variety.get('variety_description', 'Unknown')})")
            
            if not success:
                all_success = False
        
        return all_success, {}

    def test_timer_progression_system(self):
        """Test level-based timer progression"""
        success, response = self.run_test("Timer Progression", "GET", "game/timer-progression", 200, params={"max_level": 30})
        
        if success and response:
            if 'progression' not in response:
                self.missing_features.append("Timer progression structure")
                print("   ⚠️  Note: Expected 'progression' key in response")
                return False, {}
            
            progression = response['progression']
            print(f"   📊 Timer progression data points: {len(progression)}")
            
            # Check progression logic
            if len(progression) >= 3:
                level1_time = progression[0].get('timer_hours', 0)
                level10_time = next((p.get('timer_hours', 0) for p in progression if p.get('level') == 10), 0)
                level30_time = progression[-1].get('timer_hours', 0) if len(progression) >= 30 else 0
                
                print(f"   ⏰ Level 1: {level1_time}h, Level 10: {level10_time}h, Level 30: {level30_time}h")
                
                # Verify exponential growth (level 10 should be significantly more than level 1)
                if level10_time > level1_time * 2:
                    print("   ✅ Exponential timer progression confirmed")
                else:
                    print("   ⚠️  Timer progression may not be exponential as expected")
        
        return success, response

    def test_season_management_system(self):
        """Test season management endpoints"""
        # Test current season
        success1, response1 = self.run_test("Get Current Season", "GET", "seasons/current", 200)
        
        # Test season list
        success2, response2 = self.run_test("List Seasons", "GET", "seasons", 200)
        
        # Test specific season (season 1)
        success3, response3 = self.run_test("Get Season 1 Info", "GET", "seasons/1", 200)
        
        current_season_id = 1
        if success1 and response1 and 'season' in response1:
            current_season_id = response1['season'].get('season_id', 1)
            print(f"   📅 Current season: {current_season_id} - {response1['season'].get('name', 'Unknown')}")
            print(f"   📊 Season status: {response1['season'].get('status', 'Unknown')}")
            
            # Check time remaining
            if 'time_remaining' in response1:
                time_info = response1['time_remaining']
                print(f"   ⏰ Time remaining info: {time_info}")
        
        if success2 and response2:
            if 'seasons' not in response2:
                self.missing_features.append("Season list structure")
                print("   ⚠️  Note: Expected 'seasons' key in response")
            else:
                seasons_count = len(response2['seasons'])
                print(f"   📊 Total seasons available: {seasons_count}")
        
        # Test season leaderboard
        success4, response4 = self.run_test("Season Leaderboard", "GET", f"seasons/{current_season_id}/leaderboard", 200, params={"limit": 10})
        
        if success4 and response4:
            if 'leaderboard' not in response4:
                self.missing_features.append("Season leaderboard structure")
                print("   ⚠️  Note: Expected 'leaderboard' key in response")
            else:
                leaderboard_count = len(response4['leaderboard'])
                print(f"   🏆 Season leaderboard entries: {leaderboard_count}")
        
        return success1 and success2 and success3 and success4, {}

    def test_enhanced_game_mechanics_integration(self):
        """Test complete enhanced game mechanics integration"""
        print("\n🎮 Testing Complete Enhanced Game Mechanics Integration...")
        
        # Create a player for testing
        player_data = {
            "address": "0x123456789012345678901234567890123456ABCD",
            "nickname": "EnhancedGameTester",
            "is_nft_holder": True
        }
        success1, _ = self.run_test("Create Enhanced Test Player", "POST", "player", 200, data=player_data)
        
        # Test enhanced treat creation with various ingredient counts
        test_scenarios = [
            {
                "name": "Common Treat (2 ingredients)",
                "ingredients": ["strawberry", "chocolate"],
                "level": 5
            },
            {
                "name": "Rare Treat (3 ingredients)", 
                "ingredients": ["strawberry", "chocolate", "honey"],
                "level": 10
            },
            {
                "name": "Epic Treat (4 ingredients)",
                "ingredients": ["strawberry", "chocolate", "honey", "milk"],
                "level": 15
            },
            {
                "name": "Legendary Treat (5+ ingredients)",
                "ingredients": ["strawberry", "chocolate", "honey", "milk", "banana", "cookie_crumbs"],
                "level": 20
            },
            {
                "name": "Secret Combo Test",
                "ingredients": ["chocolate", "honey", "milk", "strawberry"],  # Ultimate Sweet Harmony
                "level": 25
            }
        ]
        
        all_success = True
        for scenario in test_scenarios:
            treat_data = {
                "creator_address": "0x123456789012345678901234567890123456ABCD",
                "ingredients": scenario["ingredients"],
                "player_level": scenario["level"]
            }
            
            success, response = self.run_test(scenario["name"], "POST", "treats/enhanced", 200, data=treat_data)
            
            if success and response:
                outcome = response.get('outcome', {})
                rarity = outcome.get('rarity', 'Unknown')
                timer_hours = outcome.get('timer_duration_hours', 0)
                secret_combo = outcome.get('secret_combo', {})
                
                print(f"   🎯 Result: {rarity} rarity, {timer_hours}h timer")
                if secret_combo.get('is_secret_combo'):
                    print(f"   🎉 Secret combo: {secret_combo.get('combo_name', 'Unknown')}")
            
            if not success:
                all_success = False
        
        return all_success, {}

    def test_minimum_ingredient_requirements(self):
        """Test minimum ingredient requirements for different rarities"""
        print("\n🧪 Testing Minimum Ingredient Requirements...")
        
        test_cases = [
            {
                "name": "1 Ingredient (Should Fail)",
                "ingredients": ["strawberry"],
                "should_succeed": False
            },
            {
                "name": "2 Ingredients (Common Minimum)",
                "ingredients": ["strawberry", "chocolate"],
                "should_succeed": True
            },
            {
                "name": "3 Ingredients (Rare Minimum)",
                "ingredients": ["strawberry", "chocolate", "honey"],
                "should_succeed": True
            },
            {
                "name": "5 Ingredients (Legendary Minimum)",
                "ingredients": ["strawberry", "chocolate", "honey", "milk", "banana"],
                "should_succeed": True
            }
        ]
        
        all_success = True
        for case in test_cases:
            treat_data = {
                "creator_address": self.test_player_address,
                "ingredients": case["ingredients"],
                "player_level": 10
            }
            
            expected_status = 200 if case["should_succeed"] else 400
            success, response = self.run_test(case["name"], "POST", "treats/enhanced", expected_status, data=treat_data)
            
            if case["should_succeed"] and success:
                print(f"   ✅ {case['name']}: Succeeded as expected")
            elif not case["should_succeed"] and not success:
                print(f"   ✅ {case['name']}: Failed as expected (validation working)")
            else:
                print(f"   ❌ {case['name']}: Unexpected result")
                all_success = False
        
        return all_success, {}

    def test_enhanced_game_mechanics_comprehensive(self):
        """Comprehensive test of all enhanced game mechanics"""
        print("\n🚀 COMPREHENSIVE ENHANCED GAME MECHANICS TEST")
        print("=" * 60)
        
        tests = [
            ("Enhanced Treat Creation Endpoint", self.test_enhanced_treat_creation_endpoint),
            ("Rarity Distribution Simulation", self.test_rarity_distribution_simulation),
            ("Ingredient System Endpoints", self.test_ingredient_system_endpoints),
            ("Ingredient Combination Analysis", self.test_ingredient_combination_analysis),
            ("Timer Progression System", self.test_timer_progression_system),
            ("Season Management System", self.test_season_management_system),
            ("Enhanced Game Mechanics Integration", self.test_enhanced_game_mechanics_integration),
            ("Minimum Ingredient Requirements", self.test_minimum_ingredient_requirements)
        ]
        
        passed_tests = 0
        total_tests = len(tests)
        
        for test_name, test_func in tests:
            try:
                print(f"\n{'='*40}")
                print(f"🧪 RUNNING: {test_name}")
                print(f"{'='*40}")
                success, _ = test_func()
                if success:
                    passed_tests += 1
                    print(f"✅ {test_name}: PASSED")
                else:
                    print(f"❌ {test_name}: FAILED")
            except Exception as e:
                print(f"❌ {test_name}: EXCEPTION - {str(e)}")
        
        print(f"\n🎯 ENHANCED GAME MECHANICS RESULTS: {passed_tests}/{total_tests} tests passed")
        return passed_tests == total_tests, {"passed": passed_tests, "total": total_tests}

def main():
    print("🐕 Starting DogeFood Lab Enhanced Game Mechanics API Tests 🧪")
    print("Testing Enhanced Game Mechanics: Treat Engine, Ingredients, Seasons")
    print("=" * 70)
    
    tester = DogeLabAPITester()
    
    # Enhanced Game Mechanics comprehensive test sequence
    tests = [
        # Core API Health Check
        ("Health Check", tester.test_health_check),
        
        # Setup: Create test players
        ("Multiple Wallet Addresses", tester.test_multiple_wallet_addresses),
        ("Create Player with Nickname", tester.test_create_player_with_nickname),
        ("Get Player", tester.test_get_player),
        ("Verify NFT", tester.test_verify_nft),
        ("Update Player Progress", tester.test_update_player_progress),
        
        # Phase 1 & 2 Features (ensure still working)
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
        
        # PHASE 3: ENHANCED GAME MECHANICS - COMPREHENSIVE TESTING
        ("Enhanced Game Mechanics Comprehensive", tester.test_enhanced_game_mechanics_comprehensive),
        
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
    print(f"📊 ENHANCED GAME MECHANICS TEST RESULTS: {tester.tests_passed}/{tester.tests_run} tests passed")
    print("=" * 70)
    
    # Categorize results
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    
    if success_rate >= 90:
        print("🎉 EXCELLENT: Enhanced Game Mechanics backend is highly stable!")
    elif success_rate >= 75:
        print("✅ GOOD: Enhanced Game Mechanics backend is mostly functional with minor issues")
    elif success_rate >= 50:
        print("⚠️  MODERATE: Enhanced Game Mechanics backend has significant issues requiring attention")
    else:
        print("❌ CRITICAL: Enhanced Game Mechanics backend has major failures requiring immediate fixes")
    
    # Report missing Enhanced Game Mechanics features
    if tester.missing_features:
        print(f"\n🔍 ENHANCED GAME MECHANICS FEATURES ANALYSIS:")
        print("Missing or incomplete Enhanced Game Mechanics features:")
        for feature in set(tester.missing_features):
            print(f"   ❌ {feature}")
        print(f"\nTotal missing features: {len(set(tester.missing_features))}")
    else:
        print("\n✅ All Enhanced Game Mechanics features appear to be implemented correctly!")
    
    # Final assessment
    if tester.tests_passed == tester.tests_run and not tester.missing_features:
        print("\n🚀 ENHANCED GAME MECHANICS READY FOR PRODUCTION!")
        print("All enhanced game mechanics are working perfectly.")
        return 0
    elif success_rate >= 75:
        print(f"\n⚠️  ENHANCED GAME MECHANICS MOSTLY READY - {tester.tests_run - tester.tests_passed} tests failed")
        if tester.missing_features:
            print("Some enhanced features need completion.")
        return 1
    else:
        print(f"\n🔧 ENHANCED GAME MECHANICS NEEDS WORK - {tester.tests_run - tester.tests_passed} tests failed")
        print("Significant issues require resolution before production.")
        return 1

if __name__ == "__main__":
    sys.exit(main())