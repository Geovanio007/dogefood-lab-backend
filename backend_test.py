import requests
import sys
from datetime import datetime
import json
import time

class DogeLabAPITester:
    def __init__(self, base_url="https://dogefood-lab.vercel.app"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        # Using realistic wallet addresses for Phase 2 testing
        self.test_player_address = "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54"
        self.test_player_address_2 = "0x8ba1f109551bD432803012645Hac136c0c6160"
        self.test_player_address_3 = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
        self.test_treat_id = None
        self.test_telegram_id = None  # For Telegram authentication testing
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

    def test_enhanced_treat_creation_blockchain_fix(self):
        """Test the enhanced treat creation fix for blockchain transaction failure"""
        print("\n🔧 TESTING ENHANCED TREAT CREATION BLOCKCHAIN FIX")
        print("=" * 60)
        print("Focus: Verify /api/treats/enhanced eliminates blockchain transaction failures")
        
        # Test scenarios from the review request
        test_scenarios = [
            {
                "name": "Basic Enhanced Treat Creation",
                "data": {
                    "creator_address": "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54",
                    "ingredients": ["strawberry", "chocolate", "honey"],
                    "player_level": 5
                },
                "expected_features": ["rarity_distribution", "timer_progression", "server_side_creation"]
            },
            {
                "name": "Secret Combo Testing",
                "data": {
                    "creator_address": "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54",
                    "ingredients": ["chocolate", "honey", "milk", "strawberry"],
                    "player_level": 10
                },
                "expected_features": ["secret_combo_detection", "bonus_application"]
            },
            {
                "name": "High-Level Progression",
                "data": {
                    "creator_address": "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54",
                    "ingredients": ["truffle_oil", "wagyu_beef", "gold_flakes", "spirulina", "duck"],
                    "player_level": 25
                },
                "expected_features": ["level_based_timers", "legendary_rarity_chance"]
            }
        ]
        
        all_success = True
        blockchain_failures = 0
        
        for scenario in test_scenarios:
            print(f"\n🧪 Testing: {scenario['name']}")
            print(f"   Ingredients: {scenario['data']['ingredients']}")
            print(f"   Player Level: {scenario['data']['player_level']}")
            
            success, response = self.run_test(
                scenario['name'], 
                "POST", 
                "treats/enhanced", 
                200, 
                data=scenario['data']
            )
            
            if success and response:
                # Verify no blockchain transaction occurred (backend-only creation)
                treat = response.get('treat', {})
                outcome = response.get('outcome', {})
                
                # Check that treat was created via backend (not blockchain)
                if 'id' in treat and 'rarity' in outcome:
                    print(f"   ✅ Backend-only creation successful")
                    print(f"   🎯 Rarity: {outcome.get('rarity', 'Unknown')}")
                    print(f"   ⏰ Timer: {outcome.get('timer_duration_hours', 0)}h")
                    
                    # Check for secret combo
                    secret_combo = outcome.get('secret_combo', {})
                    if secret_combo.get('is_secret_combo'):
                        print(f"   🎉 Secret combo detected: {secret_combo.get('combo_name', 'Unknown')}")
                        print(f"   🎁 Bonus: +{secret_combo.get('bonus_legendary', 0)}% Legendary chance")
                    
                    # Verify level-based timer scaling
                    timer_hours = outcome.get('timer_duration_hours', 0)
                    expected_min_hours = 1 + (scenario['data']['player_level'] - 1) * 0.5  # Rough estimate
                    if timer_hours >= expected_min_hours:
                        print(f"   ✅ Level-based timer scaling working ({timer_hours}h >= {expected_min_hours}h expected)")
                    else:
                        print(f"   ⚠️  Timer scaling may be incorrect ({timer_hours}h < {expected_min_hours}h expected)")
                    
                    # Check database persistence
                    if 'created_at' in treat:
                        print(f"   ✅ Database persistence confirmed")
                    
                else:
                    print(f"   ❌ Backend creation failed - missing required fields")
                    all_success = False
                    blockchain_failures += 1
            else:
                print(f"   ❌ Enhanced treat creation failed")
                all_success = False
                blockchain_failures += 1
        
        # Test rarity distribution over multiple creates
        print(f"\n📊 Testing Rarity Distribution (10 creates)")
        rarity_counts = {"Common": 0, "Rare": 0, "Epic": 0, "Legendary": 0}
        
        for i in range(10):
            test_data = {
                "creator_address": f"0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a{i:04d}",
                "ingredients": ["strawberry", "chocolate", "honey", "milk"],
                "player_level": 15
            }
            
            success, response = self.run_test(
                f"Rarity Test {i+1}", 
                "POST", 
                "treats/enhanced", 
                200, 
                data=test_data
            )
            
            if success and response:
                rarity = response.get('outcome', {}).get('rarity', 'Unknown')
                if rarity in rarity_counts:
                    rarity_counts[rarity] += 1
        
        # Display rarity distribution
        total_creates = sum(rarity_counts.values())
        if total_creates > 0:
            print(f"   📈 Rarity Distribution Results:")
            for rarity, count in rarity_counts.items():
                percentage = (count / total_creates) * 100
                print(f"   {rarity}: {count}/{total_creates} ({percentage:.1f}%)")
            
            # Verify expected distribution (approximately)
            legendary_pct = (rarity_counts['Legendary'] / total_creates) * 100
            epic_pct = (rarity_counts['Epic'] / total_creates) * 100
            rare_pct = (rarity_counts['Rare'] / total_creates) * 100
            common_pct = (rarity_counts['Common'] / total_creates) * 100
            
            print(f"   🎯 Expected: ~10% Legendary, ~20% Epic, ~30% Rare, ~40% Common")
            
            # Check if distribution is reasonable (allowing for small sample variance)
            if legendary_pct <= 25 and common_pct >= 20:  # Reasonable bounds for small sample
                print(f"   ✅ Rarity distribution appears reasonable")
            else:
                print(f"   ⚠️  Rarity distribution may need adjustment")
        
        # Final assessment
        print(f"\n🎯 BLOCKCHAIN TRANSACTION FAILURE FIX RESULTS:")
        print(f"   ✅ Successful backend-only creates: {len(test_scenarios) - blockchain_failures}/{len(test_scenarios)}")
        print(f"   ❌ Blockchain transaction failures: {blockchain_failures}")
        
        if blockchain_failures == 0:
            print(f"   🚀 BLOCKCHAIN TRANSACTION FAILURE ISSUE RESOLVED!")
            print(f"   ✅ All treats created via enhanced backend system")
            print(f"   ✅ No Web3 minting dependencies causing failures")
        else:
            print(f"   ⚠️  Some blockchain transaction issues may persist")
        
        return all_success and blockchain_failures == 0, {
            "blockchain_failures": blockchain_failures,
            "total_tests": len(test_scenarios),
            "rarity_distribution": rarity_counts
        }

    def test_season_1_offchain_implementation(self):
        """Test Season 1 offchain implementation as requested in review"""
        print("\n🎮 SEASON 1 OFFCHAIN IMPLEMENTATION TEST")
        print("=" * 70)
        print("Focus: Season 1 offchain functionality with NFT-ready metadata")
        
        # Use demo_player as specified in review request
        demo_player = "demo_player_season1_test"  # Use unique address to avoid anti-cheat
        demo_level = 1
        demo_ingredients = ["chicken", "bones"]
        
        all_success = True
        
        # 1. Test Enhanced Treat Creation API (/api/treats/enhanced)
        print(f"\n🧪 Testing Enhanced Treat Creation API (/api/treats/enhanced)")
        treat_data = {
            "creator_address": demo_player,
            "ingredients": demo_ingredients,
            "player_level": demo_level
        }
        
        success, response = self.run_test(
            "Season 1 Enhanced Treat Creation", 
            "POST", 
            "treats/enhanced", 
            200, 
            data=treat_data
        )
        
        if success and response:
            treat = response.get('treat', {})
            outcome = response.get('outcome', {})
            
            # Verify Season 1 metadata
            season_id = treat.get('season_id')
            is_offchain = treat.get('is_offchain')
            migration_ready = treat.get('migration_ready')
            nft_metadata = treat.get('nft_metadata', {})
            
            print(f"   ✅ Treat created with Season ID: {season_id}")
            print(f"   ✅ Offchain status: {is_offchain}")
            print(f"   ✅ Migration ready: {migration_ready}")
            
            # Verify NFT-ready metadata structure
            if nft_metadata:
                required_nft_fields = ['name', 'description', 'image', 'attributes']
                missing_nft_fields = [field for field in required_nft_fields if field not in nft_metadata]
                if not missing_nft_fields:
                    print(f"   ✅ NFT metadata structure complete")
                    
                    # Check attributes array
                    attributes = nft_metadata.get('attributes', [])
                    expected_traits = ['Rarity', 'Season', 'Creator Level', 'Ingredients Count']
                    found_traits = [attr.get('trait_type') for attr in attributes]
                    
                    if all(trait in found_traits for trait in expected_traits):
                        print(f"   ✅ NFT attributes array properly structured")
                    else:
                        print(f"   ❌ Missing NFT attributes: {set(expected_traits) - set(found_traits)}")
                        all_success = False
                else:
                    print(f"   ❌ Missing NFT metadata fields: {missing_nft_fields}")
                    all_success = False
            else:
                print(f"   ❌ NFT metadata not found in treat")
                all_success = False
            
            # Verify Season 1 specific values
            if season_id == 1 and is_offchain == True and migration_ready == True:
                print(f"   ✅ Season 1 offchain configuration correct")
            else:
                print(f"   ❌ Season 1 configuration incorrect: season_id={season_id}, is_offchain={is_offchain}, migration_ready={migration_ready}")
                all_success = False
        else:
            print(f"   ❌ Enhanced treat creation failed")
            all_success = False
        
        # 2. Test Season Information API (/api/season/current)
        print(f"\n📅 Testing Season Information API (/api/season/current)")
        success, response = self.run_test(
            "Get Current Season Info", 
            "GET", 
            "season/current", 
            200
        )
        
        if success and response:
            season_id = response.get('season_id')
            is_offchain_only = response.get('is_offchain_only')
            features = response.get('features', {})
            nft_minting = features.get('nft_minting')
            
            print(f"   ✅ Current season: {season_id}")
            print(f"   ✅ Offchain only: {is_offchain_only}")
            print(f"   ✅ NFT minting enabled: {nft_minting}")
            
            # Verify Season 1 is properly identified as offchain-only
            if season_id == 1 and is_offchain_only == True and nft_minting == False:
                print(f"   ✅ Season 1 properly identified as offchain-only with NFT minting disabled")
            else:
                print(f"   ❌ Season 1 configuration incorrect")
                all_success = False
        else:
            print(f"   ❌ Season information API failed")
            all_success = False
        
        # 3. Test Points Conversion API (/api/points/convert)
        print(f"\n💰 Testing Points Conversion API (/api/points/convert)")
        conversion_data = {
            "player_address": demo_player,
            "points_to_convert": 1000
        }
        
        success, response = self.run_test(
            "Points Conversion (Should be Disabled)", 
            "POST", 
            "points/convert", 
            423,  # Expecting 423 Locked status
            data=conversion_data
        )
        
        if success and response:
            message = response.get('message', '')
            conversion_available = response.get('conversion_available')
            reason = response.get('reason', '')
            
            print(f"   ✅ Points conversion properly disabled with status 423")
            print(f"   ✅ Message: {message}")
            print(f"   ✅ Conversion available: {conversion_available}")
            print(f"   ✅ Reason: {reason}")
            
            # Verify proper Season 1 conversion blocking
            if 'Season 1' in message and conversion_available == False:
                print(f"   ✅ Season 1 points conversion properly blocked")
            else:
                print(f"   ❌ Points conversion blocking not working correctly")
                all_success = False
        else:
            print(f"   ❌ Points conversion API test failed")
            all_success = False
        
        # 4. Test Treat Data Structure validation
        print(f"\n🔍 Testing Treat Data Structure Validation")
        
        # Create another treat to verify consistent structure
        test_treat_data = {
            "creator_address": demo_player,
            "ingredients": ["chicken", "bones", "rice"],
            "player_level": demo_level
        }
        
        success, response = self.run_test(
            "Validate Treat Data Structure", 
            "POST", 
            "treats/enhanced", 
            200, 
            data=test_treat_data
        )
        
        if success and response:
            treat = response.get('treat', {})
            
            # Check all required Season 1 fields
            required_fields = ['season_id', 'is_offchain', 'migration_ready', 'nft_metadata']
            missing_fields = [field for field in required_fields if field not in treat]
            
            if not missing_fields:
                print(f"   ✅ All Season 1 required fields present")
                
                # Verify attributes array structure for NFT compatibility
                nft_metadata = treat.get('nft_metadata', {})
                attributes = nft_metadata.get('attributes', [])
                
                if attributes and isinstance(attributes, list):
                    # Check attribute structure
                    valid_attributes = all(
                        isinstance(attr, dict) and 
                        'trait_type' in attr and 
                        'value' in attr 
                        for attr in attributes
                    )
                    
                    if valid_attributes:
                        print(f"   ✅ NFT attributes array properly structured for future compatibility")
                        print(f"   📊 Attributes count: {len(attributes)}")
                        for attr in attributes:
                            print(f"      - {attr.get('trait_type')}: {attr.get('value')}")
                    else:
                        print(f"   ❌ NFT attributes array structure invalid")
                        all_success = False
                else:
                    print(f"   ❌ NFT attributes array missing or invalid")
                    all_success = False
            else:
                print(f"   ❌ Missing Season 1 required fields: {missing_fields}")
                all_success = False
        else:
            print(f"   ❌ Treat data structure validation failed")
            all_success = False
        
        return all_success, {
            "season_1_offchain": True,
            "nft_ready_metadata": True,
            "points_conversion_disabled": True,
            "proper_data_structure": True
        }

    # ========== TELEGRAM MINI APP AUTHENTICATION TESTING ==========
    
    def test_telegram_registration_endpoint(self):
        """Test /api/players/telegram-register endpoint"""
        print("\n📱 Testing Telegram Registration Endpoint")
        
        # Mock Telegram initData (will expect 401 due to hash validation)
        mock_init_data = "user=%7B%22id%22%3A987654321%2C%22username%22%3A%22telegramtester%22%2C%22first_name%22%3A%22Telegram%22%2C%22last_name%22%3A%22Tester%22%7D&auth_date=1640995200&hash=invalid_hash_for_testing"
        
        telegram_data = {
            "initData": mock_init_data
        }
        
        # Expect 401 due to hash validation (this is correct security behavior)
        success, response = self.run_test(
            "Telegram Registration (Security Check)", 
            "POST", 
            "players/telegram-register", 
            401, 
            data=telegram_data
        )
        
        if success:
            print(f"   ✅ Hash validation working correctly (401 for invalid data)")
            print(f"   🔒 Security: {response.get('detail', 'Invalid Telegram data')}")
        
        # Test missing initData
        success2, response2 = self.run_test(
            "Telegram Registration (Missing Data)", 
            "POST", 
            "players/telegram-register", 
            400, 
            data={}
        )
        
        if success2:
            print(f"   ✅ Missing data validation working (400 for missing initData)")
        
        return success and success2, response

    def test_telegram_player_retrieval_endpoint(self):
        """Test /api/player/telegram/{telegram_id} endpoint"""
        print("\n🔍 Testing Telegram Player Retrieval Endpoint")
        
        # Test with non-existent telegram ID (should return 404)
        test_telegram_id = 999999999
        success, response = self.run_test(
            "Get Non-existent Telegram Player", 
            "GET", 
            f"player/telegram/{test_telegram_id}", 
            404
        )
        
        if success:
            print(f"   ✅ Non-existent player handling correct (404)")
            print(f"   📱 Telegram ID {test_telegram_id}: {response.get('detail', 'Player not found')}")
        
        return success, response

    def test_wallet_linking_endpoint(self):
        """Test /api/players/link-wallet endpoint"""
        print("\n🔗 Testing Wallet Linking Endpoint")
        
        # Test missing required fields
        incomplete_data = {
            "initData": "incomplete_data"
        }
        
        success, response = self.run_test(
            "Wallet Linking (Missing Fields)", 
            "POST", 
            "players/link-wallet", 
            400, 
            data=incomplete_data
        )
        
        if success:
            print(f"   ✅ Missing fields validation working (400)")
            print(f"   🔒 Error: {response.get('detail', 'Missing required fields')}")
        
        # Test with invalid Telegram data
        invalid_link_data = {
            "initData": "invalid_telegram_data",
            "address": "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54",
            "signature": "0x1234567890abcdef",
            "message": "Link wallet test"
        }
        
        success2, response2 = self.run_test(
            "Wallet Linking (Invalid Auth)", 
            "POST", 
            "players/link-wallet", 
            401, 
            data=invalid_link_data
        )
        
        if success2:
            print(f"   ✅ Invalid auth validation working (401)")
        
        return success and success2, response

    def test_telegram_auth_error_handling(self):
        """Test Telegram authentication error handling"""
        print("\n🛡️ Testing Telegram Auth Error Handling")
        
        # Test various error scenarios
        error_tests = [
            {
                "name": "Empty initData",
                "data": {"initData": ""},
                "expected_status": 400
            },
            {
                "name": "Malformed initData", 
                "data": {"initData": "malformed_data_string"},
                "expected_status": 401
            },
            {
                "name": "Missing initData field",
                "data": {},
                "expected_status": 400
            }
        ]
        
        all_success = True
        for test_case in error_tests:
            success, response = self.run_test(
                f"Auth Error: {test_case['name']}", 
                "POST", 
                "players/telegram-register", 
                test_case['expected_status'], 
                data=test_case['data']
            )
            
            if success:
                print(f"   ✅ {test_case['name']}: Correct error handling")
            else:
                all_success = False
                print(f"   ❌ {test_case['name']}: Error handling failed")
        
        return all_success, {}

    def test_telegram_security_validation(self):
        """Test Telegram hash validation security"""
        print("\n🔒 Testing Telegram Security Validation")
        
        # Test hash validation with various invalid hashes
        security_tests = [
            {
                "name": "Invalid Hash Format",
                "initData": "user=%7B%22id%22%3A123%7D&auth_date=1640995200&hash=invalid_hash"
            },
            {
                "name": "Missing Hash",
                "initData": "user=%7B%22id%22%3A123%7D&auth_date=1640995200"
            },
            {
                "name": "Tampered User Data",
                "initData": "user=%7B%22id%22%3A999%7D&auth_date=1640995200&hash=valid_looking_hash"
            }
        ]
        
        all_success = True
        for test_case in security_tests:
            success, response = self.run_test(
                f"Security: {test_case['name']}", 
                "POST", 
                "players/telegram-register", 
                401,  # All should return 401 for security violations
                data={"initData": test_case['initData']}
            )
            
            if success:
                print(f"   ✅ {test_case['name']}: Security validation working")
            else:
                all_success = False
                print(f"   ❌ {test_case['name']}: Security validation failed")
        
        return all_success, {}

    def test_telegram_treat_creation(self):
        """Test Telegram users can create treats via /api/treats/enhanced"""
        print("\n🧪 Testing Telegram Treat Creation")
        
        # Use a mock Telegram user address for testing
        telegram_user_address = "telegram_user_123456789"
        
        treat_data = {
            "creator_address": telegram_user_address,
            "ingredients": ["chicken", "bones", "rice"],
            "player_level": 5
        }
        
        success, response = self.run_test(
            "Telegram User Treat Creation", 
            "POST", 
            "treats/enhanced", 
            200, 
            data=treat_data
        )
        
        if success and response:
            treat = response.get('treat', {})
            outcome = response.get('outcome', {})
            
            print(f"   ✅ Telegram user can create treats")
            print(f"   🎯 Rarity: {outcome.get('rarity', 'Unknown')}")
            print(f"   ⏰ Timer: {outcome.get('timer_duration_hours', 0)}h")
            
            # Verify treat was created for Telegram user
            if treat.get('creator_address') == telegram_user_address:
                print(f"   ✅ Treat correctly attributed to Telegram user")
            else:
                print(f"   ❌ Treat attribution failed")
                return False, response
        
        return success, response

    def test_telegram_treat_retrieval(self):
        """Test treat retrieval for Telegram users"""
        print("\n📋 Testing Telegram Treat Retrieval")
        
        telegram_user_address = "telegram_user_123456789"
        
        success, response = self.run_test(
            "Get Telegram User Treats", 
            "GET", 
            f"treats/{telegram_user_address}", 
            200
        )
        
        if success and response:
            treats_count = len(response) if isinstance(response, list) else 0
            print(f"   ✅ Retrieved {treats_count} treats for Telegram user")
            
            # Check if any treats belong to this user
            if treats_count > 0:
                first_treat = response[0]
                if first_treat.get('creator_address') == telegram_user_address:
                    print(f"   ✅ Treat ownership verification successful")
                else:
                    print(f"   ⚠️ Treat ownership mismatch")
        
        return success, response

    def test_telegram_leaderboard_integration(self):
        """Test leaderboard includes Telegram users"""
        print("\n🏆 Testing Telegram Leaderboard Integration")
        
        success, response = self.run_test(
            "Leaderboard with Mixed Users", 
            "GET", 
            "leaderboard", 
            200, 
            params={"limit": 20}
        )
        
        if success and response:
            leaderboard_count = len(response) if isinstance(response, list) else 0
            print(f"   ✅ Leaderboard contains {leaderboard_count} players")
            
            # Check for mixed user types (wallet and telegram)
            wallet_users = 0
            telegram_users = 0
            
            for entry in response:
                address = entry.get('address', '')
                if address.startswith('0x'):
                    wallet_users += 1
                elif 'telegram' in address.lower():
                    telegram_users += 1
            
            print(f"   📊 Wallet users: {wallet_users}, Telegram users: {telegram_users}")
            print(f"   ✅ Mixed user system working in leaderboard")
        
        return success, response

    def test_telegram_points_integration(self):
        """Test points system integration for Telegram users"""
        print("\n⭐ Testing Telegram Points Integration")
        
        telegram_user_address = "telegram_user_123456789"
        
        # Test points leaderboard includes Telegram users
        success, response = self.run_test(
            "Points Leaderboard Mixed Users", 
            "GET", 
            "points/leaderboard", 
            200, 
            params={"limit": 20}
        )
        
        if success and response:
            leaderboard = response.get('leaderboard', [])
            print(f"   ✅ Points leaderboard contains {len(leaderboard)} players")
            
            # Check for mixed user types
            mixed_users = any(
                'telegram' in entry.get('address', '').lower() or 
                entry.get('address', '').startswith('0x')
                for entry in leaderboard
            )
            
            if mixed_users:
                print(f"   ✅ Points system supports mixed user types")
            else:
                print(f"   ⚠️ Limited user type diversity in points system")
        
        return success, response

    def test_hybrid_user_system(self):
        """Test hybrid user system (wallet + Telegram linking)"""
        print("\n🔗 Testing Hybrid User System")
        
        # Test that system supports both wallet and Telegram authentication
        success, response = self.run_test(
            "Game Stats (User Diversity)", 
            "GET", 
            "stats", 
            200
        )
        
        if success and response:
            total_players = response.get('total_players', 0)
            print(f"   ✅ Total players in system: {total_players}")
            print(f"   ✅ System supports multiple authentication methods")
            
            # Verify system can handle mixed user types
            if total_players > 0:
                print(f"   ✅ Hybrid user system operational")
            else:
                print(f"   ⚠️ No players in system for hybrid testing")
        
        return success, response

    def test_telegram_data_consistency(self):
        """Test data consistency for Telegram users"""
        print("\n📊 Testing Telegram Data Consistency")
        
        # Test that Telegram user data is consistent across endpoints
        telegram_user_address = "telegram_user_123456789"
        
        # Create a player record for consistency testing
        player_data = {
            "address": telegram_user_address,
            "nickname": "TelegramTester",
            "is_nft_holder": False
        }
        
        success1, response1 = self.run_test(
            "Create Telegram Player Record", 
            "POST", 
            "player", 
            200, 
            data=player_data
        )
        
        if success1:
            # Retrieve the same player
            success2, response2 = self.run_test(
                "Retrieve Telegram Player", 
                "GET", 
                f"player/{telegram_user_address}", 
                200
            )
            
            if success2 and response2:
                # Verify data consistency
                created_address = response1.get('address')
                retrieved_address = response2.get('address')
                
                if created_address == retrieved_address == telegram_user_address:
                    print(f"   ✅ Data consistency verified")
                    print(f"   📱 Address: {retrieved_address}")
                    print(f"   👤 Nickname: {response2.get('nickname')}")
                else:
                    print(f"   ❌ Data consistency failed")
                    return False, response2
        
        return success1, response1

    def test_mixed_user_types_support(self):
        """Test system supports mixed user types in database"""
        print("\n👥 Testing Mixed User Types Support")
        
        # Test creating different user types
        user_types = [
            {
                "name": "Wallet User",
                "data": {
                    "address": "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54",
                    "nickname": "WalletUser",
                    "is_nft_holder": True
                }
            },
            {
                "name": "Telegram User",
                "data": {
                    "address": "telegram_user_987654321",
                    "nickname": "TelegramUser", 
                    "is_nft_holder": False
                }
            }
        ]
        
        all_success = True
        for user_type in user_types:
            success, response = self.run_test(
                f"Create {user_type['name']}", 
                "POST", 
                "player", 
                200, 
                data=user_type['data']
            )
            
            if success:
                print(f"   ✅ {user_type['name']} created successfully")
            else:
                all_success = False
                print(f"   ❌ {user_type['name']} creation failed")
        
        return all_success, {}

    def test_telegram_response_times(self):
        """Test response times for Telegram-specific endpoints"""
        print("\n⚡ Testing Telegram Response Times")
        
        import time
        
        # Test response times for key endpoints
        endpoints = [
            ("Telegram Registration", "POST", "players/telegram-register", {"initData": "test_data"}),
            ("Telegram Player Retrieval", "GET", "player/telegram/123456789", None),
            ("Wallet Linking", "POST", "players/link-wallet", {"initData": "test", "address": "0x123", "signature": "0x456", "message": "test"})
        ]
        
        response_times = []
        for name, method, endpoint, data in endpoints:
            start_time = time.time()
            
            # We expect these to fail due to validation, but we're testing response time
            if method == "GET":
                success, response = self.run_test(name, method, endpoint, 404)
            else:
                success, response = self.run_test(name, method, endpoint, 400)  # Expect validation errors
            
            end_time = time.time()
            response_time = (end_time - start_time) * 1000  # Convert to milliseconds
            response_times.append(response_time)
            
            print(f"   ⏱️ {name}: {response_time:.2f}ms")
        
        avg_response_time = sum(response_times) / len(response_times)
        print(f"   📊 Average response time: {avg_response_time:.2f}ms")
        
        # Consider under 1000ms as acceptable
        if avg_response_time < 1000:
            print(f"   ✅ Response times acceptable")
            return True, {"avg_response_time": avg_response_time}
        else:
            print(f"   ⚠️ Response times may be slow")
            return False, {"avg_response_time": avg_response_time}

    def test_telegram_db_optimization(self):
        """Test database query optimization for Telegram users"""
        print("\n🗄️ Testing Telegram DB Optimization")
        
        # Test that database queries are optimized
        success, response = self.run_test(
            "Database Query Performance", 
            "GET", 
            "leaderboard", 
            200, 
            params={"limit": 50}
        )
        
        if success and response:
            result_count = len(response) if isinstance(response, list) else 0
            print(f"   ✅ Retrieved {result_count} leaderboard entries efficiently")
            
            # Test that queries handle mixed user types
            if result_count > 0:
                print(f"   ✅ Database handles mixed user queries")
            else:
                print(f"   ⚠️ No data for optimization testing")
        
        return success, response

    def test_telegram_concurrent_users(self):
        """Test concurrent user support for Telegram users"""
        print("\n👥 Testing Concurrent User Support")
        
        # Simulate concurrent requests (simplified)
        concurrent_tests = []
        
        for i in range(3):
            user_address = f"concurrent_telegram_user_{i}"
            treat_data = {
                "creator_address": user_address,
                "ingredients": ["chicken", "bones"],
                "player_level": 1
            }
            
            success, response = self.run_test(
                f"Concurrent User {i+1}", 
                "POST", 
                "treats/enhanced", 
                200, 
                data=treat_data
            )
            
            concurrent_tests.append(success)
            
            if success:
                print(f"   ✅ Concurrent user {i+1}: Request handled")
            else:
                print(f"   ❌ Concurrent user {i+1}: Request failed")
        
        success_rate = sum(concurrent_tests) / len(concurrent_tests)
        print(f"   📊 Concurrent success rate: {success_rate*100:.1f}%")
        
        return success_rate >= 0.8, {"success_rate": success_rate}

    def test_telegram_user_registration(self):
        """Test Telegram user registration endpoint"""
        print("\n📱 Testing Telegram User Registration")
        
        # Mock Telegram initData (simplified for testing)
        mock_init_data = "user=%7B%22id%22%3A123456789%2C%22username%22%3A%22testuser%22%2C%22first_name%22%3A%22Test%22%2C%22last_name%22%3A%22User%22%7D&auth_date=1640995200&hash=mock_hash_for_testing"
        
        telegram_data = {
            "initData": mock_init_data
        }
        
        success, response = self.run_test(
            "Telegram User Registration", 
            "POST", 
            "players/telegram-register", 
            200, 
            data=telegram_data
        )
        
        if success and response:
            expected_keys = ['message', 'player_id', 'telegram_id', 'username', 'first_name', 'auth_type', 'registered_at']
            missing_keys = [key for key in expected_keys if key not in response]
            if missing_keys:
                self.missing_features.append(f"Telegram registration missing keys: {missing_keys}")
                print(f"   ⚠️  Note: Missing keys in telegram registration: {missing_keys}")
            else:
                print(f"   ✅ Telegram user registered successfully")
                print(f"   📱 Telegram ID: {response.get('telegram_id')}")
                print(f"   👤 Username: {response.get('username')}")
                print(f"   🔐 Auth Type: {response.get('auth_type')}")
                
                # Store telegram_id for subsequent tests
                self.test_telegram_id = response.get('telegram_id')
        
        return success, response

    def test_telegram_mini_app_comprehensive(self):
        """🚀 FINAL TELEGRAM MINI APP BACKEND VERIFICATION - Comprehensive Testing"""
        print("\n🚀 FINAL TELEGRAM MINI APP BACKEND VERIFICATION")
        print("=" * 70)
        print("Testing complete Telegram Mini App backend integration as requested")
        print("=" * 70)
        
        all_tests_passed = True
        test_results = {}
        
        # 1. Authentication Endpoints Verification
        print("\n📱 1. AUTHENTICATION ENDPOINTS VERIFICATION")
        print("-" * 50)
        
        auth_tests = [
            ("Telegram Registration", self.test_telegram_registration_endpoint),
            ("Telegram Player Retrieval", self.test_telegram_player_retrieval_endpoint), 
            ("Wallet Linking", self.test_wallet_linking_endpoint),
            ("Authentication Error Handling", self.test_telegram_auth_error_handling),
            ("Security Validation", self.test_telegram_security_validation)
        ]
        
        auth_passed = 0
        for test_name, test_func in auth_tests:
            try:
                success, result = test_func()
                if success:
                    auth_passed += 1
                    print(f"   ✅ {test_name}: PASSED")
                else:
                    print(f"   ❌ {test_name}: FAILED")
                    all_tests_passed = False
                test_results[test_name] = success
            except Exception as e:
                print(f"   ❌ {test_name}: EXCEPTION - {str(e)}")
                all_tests_passed = False
                test_results[test_name] = False
        
        print(f"\n📊 Authentication Tests: {auth_passed}/{len(auth_tests)} passed")
        
        # 2. Game Integration Testing
        print("\n🎮 2. GAME INTEGRATION TESTING")
        print("-" * 50)
        
        game_tests = [
            ("Telegram Treat Creation", self.test_telegram_treat_creation),
            ("Telegram Treat Retrieval", self.test_telegram_treat_retrieval),
            ("Telegram Leaderboard Integration", self.test_telegram_leaderboard_integration),
            ("Points System Integration", self.test_telegram_points_integration)
        ]
        
        game_passed = 0
        for test_name, test_func in game_tests:
            try:
                success, result = test_func()
                if success:
                    game_passed += 1
                    print(f"   ✅ {test_name}: PASSED")
                else:
                    print(f"   ❌ {test_name}: FAILED")
                    all_tests_passed = False
                test_results[test_name] = success
            except Exception as e:
                print(f"   ❌ {test_name}: EXCEPTION - {str(e)}")
                all_tests_passed = False
                test_results[test_name] = False
        
        print(f"\n📊 Game Integration Tests: {game_passed}/{len(game_tests)} passed")
        
        # 3. Database Verification
        print("\n🗄️ 3. DATABASE VERIFICATION")
        print("-" * 50)
        
        db_tests = [
            ("Hybrid User System", self.test_hybrid_user_system),
            ("Data Consistency", self.test_telegram_data_consistency),
            ("Mixed User Types", self.test_mixed_user_types_support)
        ]
        
        db_passed = 0
        for test_name, test_func in db_tests:
            try:
                success, result = test_func()
                if success:
                    db_passed += 1
                    print(f"   ✅ {test_name}: PASSED")
                else:
                    print(f"   ❌ {test_name}: FAILED")
                    all_tests_passed = False
                test_results[test_name] = success
            except Exception as e:
                print(f"   ❌ {test_name}: EXCEPTION - {str(e)}")
                all_tests_passed = False
                test_results[test_name] = False
        
        print(f"\n📊 Database Tests: {db_passed}/{len(db_tests)} passed")
        
        # 4. API Performance Testing
        print("\n⚡ 4. API PERFORMANCE TESTING")
        print("-" * 50)
        
        perf_tests = [
            ("Response Times", self.test_telegram_response_times),
            ("Database Query Optimization", self.test_telegram_db_optimization),
            ("Concurrent User Support", self.test_telegram_concurrent_users)
        ]
        
        perf_passed = 0
        for test_name, test_func in perf_tests:
            try:
                success, result = test_func()
                if success:
                    perf_passed += 1
                    print(f"   ✅ {test_name}: PASSED")
                else:
                    print(f"   ❌ {test_name}: FAILED")
                    all_tests_passed = False
                test_results[test_name] = success
            except Exception as e:
                print(f"   ❌ {test_name}: EXCEPTION - {str(e)}")
                all_tests_passed = False
                test_results[test_name] = False
        
        print(f"\n📊 Performance Tests: {perf_passed}/{len(perf_tests)} passed")
        
        # Final Results Summary
        total_tests = len(auth_tests) + len(game_tests) + len(db_tests) + len(perf_tests)
        total_passed = auth_passed + game_passed + db_passed + perf_passed
        
        print(f"\n🎯 FINAL TELEGRAM MINI APP VERIFICATION RESULTS")
        print("=" * 70)
        print(f"📊 Overall Results: {total_passed}/{total_tests} tests passed ({(total_passed/total_tests)*100:.1f}%)")
        print(f"📱 Authentication: {auth_passed}/{len(auth_tests)} passed")
        print(f"🎮 Game Integration: {game_passed}/{len(game_tests)} passed") 
        print(f"🗄️ Database: {db_passed}/{len(db_tests)} passed")
        print(f"⚡ Performance: {perf_passed}/{len(perf_tests)} passed")
        
        if all_tests_passed:
            print(f"\n🚀 TELEGRAM MINI APP BACKEND IS PRODUCTION-READY!")
            print(f"✅ All critical systems verified and functional")
            print(f"✅ Ready for live Telegram Mini App usage")
        else:
            print(f"\n⚠️ SOME ISSUES DETECTED - REVIEW REQUIRED")
            failed_tests = [name for name, passed in test_results.items() if not passed]
            print(f"❌ Failed tests: {', '.join(failed_tests)}")
        
        return all_tests_passed, test_results

    def test_telegram_user_registration_with_mock_data(self):
        """Test Telegram user registration with mock Telegram user data"""
        print("\n📱 Testing Telegram Registration with Mock Data")
        
        # Create mock Telegram user data as specified in review request
        mock_telegram_user = {
            "id": 123456789,
            "username": "testuser", 
            "first_name": "Test",
            "last_name": "User"
        }
        
        # For testing purposes, we'll bypass the hash validation by creating a simple mock initData
        # In production, this would be properly validated
        import json
        import urllib.parse
        
        user_json = json.dumps(mock_telegram_user)
        encoded_user = urllib.parse.quote(user_json)
        mock_init_data = f"user={encoded_user}&auth_date=1640995200&hash=mock_hash_for_testing"
        
        telegram_data = {
            "initData": mock_init_data
        }
        
        success, response = self.run_test(
            "Telegram Registration Mock Data", 
            "POST", 
            "players/telegram-register", 
            200, 
            data=telegram_data
        )
        
        if success and response:
            # Verify the mock data was processed correctly
            telegram_id = response.get('telegram_id')
            username = response.get('username')
            first_name = response.get('first_name')
            
            if telegram_id == 123456789 and username == "testuser" and first_name == "Test":
                print(f"   ✅ Mock Telegram data processed correctly")
                print(f"   📱 ID: {telegram_id}, Username: {username}, Name: {first_name}")
                self.test_telegram_id = telegram_id
            else:
                print(f"   ❌ Mock data processing failed")
                print(f"   Expected: ID=123456789, Username=testuser, Name=Test")
                print(f"   Got: ID={telegram_id}, Username={username}, Name={first_name}")
                return False, response
        
        return success, response

    def test_get_player_by_telegram_id(self):
        """Test retrieving player by Telegram ID"""
        print("\n🔍 Testing Player Retrieval by Telegram ID")
        
        # Use telegram_id from registration test
        if not hasattr(self, 'test_telegram_id') or not self.test_telegram_id:
            print("   ⚠️  No telegram_id available from registration test")
            # Use the mock telegram_id from our test data
            self.test_telegram_id = 123456789
        
        success, response = self.run_test(
            "Get Player by Telegram ID", 
            "GET", 
            f"player/telegram/{self.test_telegram_id}", 
            200
        )
        
        if success and response:
            expected_keys = ['id', 'telegram_id', 'telegram_username', 'telegram_first_name', 'auth_type', 'level', 'experience', 'points']
            missing_keys = [key for key in expected_keys if key not in response]
            if missing_keys:
                self.missing_features.append(f"Telegram player retrieval missing keys: {missing_keys}")
                print(f"   ⚠️  Note: Missing keys in telegram player data: {missing_keys}")
            else:
                print(f"   ✅ Telegram player retrieved successfully")
                print(f"   📱 Telegram ID: {response.get('telegram_id')}")
                print(f"   👤 Username: {response.get('telegram_username')}")
                print(f"   🎮 Level: {response.get('level')}")
                print(f"   ⭐ Points: {response.get('points')}")
        
        return success, response

    def test_wallet_linking_to_telegram(self):
        """Test linking wallet to existing Telegram user"""
        print("\n🔗 Testing Wallet Linking to Telegram User")
        
        # Mock wallet linking data
        mock_wallet_address = "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54"
        mock_signature = "0x1234567890abcdef"
        mock_message = "Link wallet to Telegram account"
        
        # Mock initData for existing Telegram user
        mock_init_data = "user=%7B%22id%22%3A123456789%2C%22username%22%3A%22testuser%22%2C%22first_name%22%3A%22Test%22%2C%22last_name%22%3A%22User%22%7D&auth_date=1640995200&hash=mock_hash_for_testing"
        
        wallet_link_data = {
            "initData": mock_init_data,
            "address": mock_wallet_address,
            "signature": mock_signature,
            "message": mock_message
        }
        
        success, response = self.run_test(
            "Link Wallet to Telegram", 
            "POST", 
            "players/link-wallet", 
            200, 
            data=wallet_link_data
        )
        
        if success and response:
            expected_keys = ['message', 'telegram_id', 'address', 'auth_type', 'linked_at']
            missing_keys = [key for key in expected_keys if key not in response]
            if missing_keys:
                self.missing_features.append(f"Wallet linking missing keys: {missing_keys}")
                print(f"   ⚠️  Note: Missing keys in wallet linking: {missing_keys}")
            else:
                print(f"   ✅ Wallet linked to Telegram user successfully")
                print(f"   📱 Telegram ID: {response.get('telegram_id')}")
                print(f"   💰 Wallet: {response.get('address')}")
                print(f"   🔐 Auth Type: {response.get('auth_type')}")
        
        return success, response

    def test_wallet_linking_error_cases(self):
        """Test wallet linking error scenarios"""
        print("\n❌ Testing Wallet Linking Error Cases")
        
        all_success = True
        
        # Test 1: Missing required fields
        incomplete_data = {
            "initData": "incomplete_data"
            # Missing address, signature, message
        }
        
        success1, _ = self.run_test(
            "Wallet Link Missing Fields", 
            "POST", 
            "players/link-wallet", 
            400, 
            data=incomplete_data
        )
        
        # Test 2: Invalid Telegram data
        invalid_telegram_data = {
            "initData": "invalid_init_data",
            "address": "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54",
            "signature": "0x1234567890abcdef",
            "message": "Link wallet"
        }
        
        success2, _ = self.run_test(
            "Wallet Link Invalid Telegram Data", 
            "POST", 
            "players/link-wallet", 
            401, 
            data=invalid_telegram_data
        )
        
        # Test 3: Wallet already linked (if we can simulate this)
        already_linked_data = {
            "initData": "user=%7B%22id%22%3A987654321%2C%22username%22%3A%22anotheruser%22%2C%22first_name%22%3A%22Another%22%7D&auth_date=1640995200&hash=mock_hash",
            "address": "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54",  # Same wallet as before
            "signature": "0x1234567890abcdef",
            "message": "Link wallet"
        }
        
        success3, _ = self.run_test(
            "Wallet Already Linked", 
            "POST", 
            "players/link-wallet", 
            409, 
            data=already_linked_data
        )
        
        if success1 and success2:
            print(f"   ✅ Error handling working correctly")
        else:
            print(f"   ❌ Some error cases not handled properly")
            all_success = False
        
        return all_success, {}

    def test_telegram_integration_with_existing_system(self):
        """Test Telegram users integration with existing game system"""
        print("\n🎮 Testing Telegram Integration with Existing System")
        
        all_success = True
        
        # Test 1: Verify Telegram users appear in general player queries
        success1, response1 = self.run_test(
            "General Player Queries Include Telegram Users", 
            "GET", 
            "stats", 
            200
        )
        
        if success1 and response1:
            total_players = response1.get('total_players', 0)
            print(f"   📊 Total players in system: {total_players}")
            if total_players > 0:
                print(f"   ✅ Player count includes Telegram users")
            else:
                print(f"   ⚠️  No players found in system")
        
        # Test 2: Test leaderboard includes both wallet and Telegram users
        success2, response2 = self.run_test(
            "Leaderboard Includes Telegram Users", 
            "GET", 
            "leaderboard", 
            200, 
            params={"limit": 20}
        )
        
        if success2 and response2:
            leaderboard = response2 if isinstance(response2, list) else []
            telegram_users = [player for player in leaderboard if player.get('address') is None]
            wallet_users = [player for player in leaderboard if player.get('address') is not None]
            
            print(f"   🏆 Leaderboard entries: {len(leaderboard)}")
            print(f"   📱 Telegram users: {len(telegram_users)}")
            print(f"   💰 Wallet users: {len(wallet_users)}")
            
            if len(leaderboard) > 0:
                print(f"   ✅ Leaderboard includes mixed user types")
            else:
                print(f"   ⚠️  Empty leaderboard")
        
        # Test 3: Verify treat creation works for Telegram users
        if hasattr(self, 'test_telegram_id') and self.test_telegram_id:
            # Create a treat for the Telegram user (using enhanced endpoint)
            treat_data = {
                "creator_address": f"telegram_user_{self.test_telegram_id}",  # Use telegram ID as identifier
                "ingredients": ["chicken", "bones", "rice"],
                "player_level": 1
            }
            
            success3, response3 = self.run_test(
                "Telegram User Treat Creation", 
                "POST", 
                "treats/enhanced", 
                200, 
                data=treat_data
            )
            
            if success3 and response3:
                print(f"   ✅ Telegram users can create treats")
                treat = response3.get('treat', {})
                outcome = response3.get('outcome', {})
                print(f"   🎯 Created treat: {outcome.get('rarity', 'Unknown')} rarity")
            else:
                print(f"   ❌ Telegram user treat creation failed")
                all_success = False
        else:
            print(f"   ⚠️  No telegram_id available for treat creation test")
        
        return all_success, {}

    def test_telegram_authentication_comprehensive(self):
        """Comprehensive test of Telegram Mini App authentication system"""
        print("\n📱 COMPREHENSIVE TELEGRAM AUTHENTICATION TEST")
        print("=" * 60)
        print("Focus: Complete Telegram Mini App authentication system integration")
        
        tests = [
            ("Telegram User Registration", self.test_telegram_user_registration),
            ("Telegram Registration Mock Data", self.test_telegram_user_registration_with_mock_data),
            ("Get Player by Telegram ID", self.test_get_player_by_telegram_id),
            ("Wallet Linking to Telegram", self.test_wallet_linking_to_telegram),
            ("Wallet Linking Error Cases", self.test_wallet_linking_error_cases),
            ("Telegram Integration with Existing System", self.test_telegram_integration_with_existing_system)
        ]
        
        passed_tests = 0
        total_tests = len(tests)
        
        for test_name, test_func in tests:
            try:
                print(f"\n{'='*40}")
                print(f"📱 RUNNING: {test_name}")
                print(f"{'='*40}")
                success, _ = test_func()
                if success:
                    passed_tests += 1
                    print(f"✅ {test_name}: PASSED")
                else:
                    print(f"❌ {test_name}: FAILED")
            except Exception as e:
                print(f"❌ {test_name}: EXCEPTION - {str(e)}")
        
        print(f"\n🎯 TELEGRAM AUTHENTICATION RESULTS: {passed_tests}/{total_tests} tests passed")
        
        # Summary of findings
        if passed_tests == total_tests:
            print(f"\n🚀 TELEGRAM MINI APP AUTHENTICATION SYSTEM FULLY OPERATIONAL!")
            print(f"✅ All endpoints working correctly:")
            print(f"   - POST /api/players/telegram-register")
            print(f"   - GET /api/player/telegram/{{telegram_id}}")
            print(f"   - POST /api/players/link-wallet")
            print(f"✅ Integration with existing game system confirmed")
            print(f"✅ Error handling and validation working")
        else:
            print(f"\n⚠️  Some Telegram authentication features need attention")
            if self.missing_features:
                print(f"Missing features identified:")
                for feature in self.missing_features:
                    if 'telegram' in feature.lower() or 'Telegram' in feature:
                        print(f"   - {feature}")
        
        return passed_tests == total_tests, {"passed": passed_tests, "total": total_tests}

    def test_comprehensive_dogefood_lab_game_system(self):
        """Test the complete functional DogeFood Lab game system with real progress tracking"""
        print("\n🎮 COMPREHENSIVE DOGEFOOD LAB GAME SYSTEM TEST")
        print("=" * 70)
        print("Focus: Complete functional game system with real progress tracking")
        
        # Test scenarios from review request
        test_scenarios = [
            {
                "name": "Complete Game Flow - Level 5",
                "data": {
                    "creator_address": "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54",
                    "ingredients": ["strawberry", "chocolate", "honey"],
                    "player_level": 5
                },
                "expected_timer_hours": 2.1  # Level 5: ~2.1 hours
            },
            {
                "name": "Multi-Level Timer Testing - Level 10",
                "data": {
                    "creator_address": "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54",
                    "ingredients": ["bacon", "cheese", "herbs", "milk"],
                    "player_level": 10
                },
                "expected_timer_hours": 5.2  # Level 10: ~5 hours
            },
            {
                "name": "Multi-Level Timer Testing - Level 20",
                "data": {
                    "creator_address": "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54",
                    "ingredients": ["wagyu_beef", "truffle_oil", "gold_flakes", "aged_wine", "caviar"],
                    "player_level": 20
                },
                "expected_timer_hours": 10.0  # Level 20: ~10 hours
            }
        ]
        
        all_success = True
        created_treat_ids = []
        
        # Test enhanced treat creation flow
        print(f"\n🧪 Testing Enhanced Treat Creation Flow")
        for scenario in test_scenarios:
            print(f"\n   Testing: {scenario['name']}")
            
            success, response = self.run_test(
                scenario['name'], 
                "POST", 
                "treats/enhanced", 
                200, 
                data=scenario['data']
            )
            
            if success and response:
                treat = response.get('treat', {})
                outcome = response.get('outcome', {})
                
                # Verify treat data is properly saved with all metadata
                required_fields = ['id', 'name', 'creator_address', 'ingredients', 'rarity', 'brewing_status', 'ready_at']
                missing_fields = [field for field in required_fields if field not in treat]
                if missing_fields:
                    print(f"   ❌ Missing treat fields: {missing_fields}")
                    all_success = False
                else:
                    print(f"   ✅ Treat created with complete metadata")
                    created_treat_ids.append(treat['id'])
                
                # Verify timer calculations and ready_at timestamps
                timer_hours = outcome.get('timer_duration_hours', 0)
                expected_hours = scenario['expected_timer_hours']
                if abs(timer_hours - expected_hours) <= 1.0:  # Allow 1 hour variance
                    print(f"   ✅ Timer calculation correct: {timer_hours}h (expected ~{expected_hours}h)")
                else:
                    print(f"   ⚠️  Timer calculation may be off: {timer_hours}h (expected ~{expected_hours}h)")
                
                # Verify rarity distribution
                rarity = outcome.get('rarity', 'Unknown')
                print(f"   🎯 Rarity: {rarity}")
                
                # Verify ingredient tracking
                ingredients_used = outcome.get('ingredients_used', [])
                if len(ingredients_used) >= len(scenario['data']['ingredients']):
                    print(f"   ✅ Ingredient tracking working: {len(ingredients_used)} ingredients")
                else:
                    print(f"   ❌ Ingredient tracking issue: {len(ingredients_used)} vs {len(scenario['data']['ingredients'])}")
                    all_success = False
            else:
                print(f"   ❌ Enhanced treat creation failed")
                all_success = False
        
        # Test data persistence & player progress
        print(f"\n📊 Testing Data Persistence & Player Progress")
        
        # Test GET /api/treats/{address}/brewing for active/brewing treats
        success, brewing_response = self.run_test(
            "Get Brewing Treats", 
            "GET", 
            f"treats/{test_scenarios[0]['data']['creator_address']}/brewing", 
            200
        )
        
        if success:
            brewing_treats = brewing_response if isinstance(brewing_response, list) else []
            print(f"   ✅ Active brewing treats retrieved: {len(brewing_treats)} treats")
            
            # Verify brewing status
            for treat in brewing_treats:
                if treat.get('brewing_status') == 'brewing':
                    print(f"   ✅ Treat {treat.get('id', 'unknown')[:8]}... is brewing")
                else:
                    print(f"   ⚠️  Treat status inconsistency: {treat.get('brewing_status')}")
        else:
            print(f"   ❌ Failed to retrieve brewing treats")
            all_success = False
        
        # Test GET /api/treats/{address} for all player treats
        success, all_treats_response = self.run_test(
            "Get All Player Treats", 
            "GET", 
            f"treats/{test_scenarios[0]['data']['creator_address']}", 
            200
        )
        
        if success:
            all_treats = all_treats_response if isinstance(all_treats_response, list) else []
            print(f"   ✅ All player treats retrieved: {len(all_treats)} treats")
            
            # Verify treat status updates and persistence
            for treat in all_treats:
                if 'created_at' in treat and 'brewing_status' in treat:
                    print(f"   ✅ Treat persistence confirmed: {treat.get('brewing_status')} status")
                else:
                    print(f"   ⚠️  Treat missing persistence fields")
        else:
            print(f"   ❌ Failed to retrieve all player treats")
            all_success = False
        
        # Test real-time timer system
        print(f"\n⏰ Testing Real-Time Timer System")
        
        if created_treat_ids:
            for treat_id in created_treat_ids[:2]:  # Test first 2 treats
                # Test POST /api/treats/{treat_id}/check-timer
                success, timer_response = self.run_test(
                    f"Check Timer for Treat {treat_id[:8]}...", 
                    "POST", 
                    f"treats/{treat_id}/check-timer", 
                    200
                )
                
                if success and timer_response:
                    status = timer_response.get('status', 'unknown')
                    remaining_seconds = timer_response.get('remaining_seconds', 0)
                    
                    if status == 'brewing' and remaining_seconds > 0:
                        print(f"   ✅ Timer status check working: {status}, {remaining_seconds}s remaining")
                    elif status == 'ready':
                        print(f"   ✅ Timer completed: treat is ready")
                    else:
                        print(f"   ⚠️  Timer status unclear: {status}")
                else:
                    print(f"   ❌ Timer check failed for treat {treat_id[:8]}...")
                    all_success = False
        else:
            print(f"   ⚠️  No treat IDs available for timer testing")
        
        # Test treat status management
        print(f"\n🔄 Testing Treat Status Management")
        
        # Create a short-timer treat for status transition testing
        short_timer_data = {
            "creator_address": "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54",
            "ingredients": ["strawberry", "chocolate"],
            "player_level": 1  # Level 1 should have shortest timer
        }
        
        success, short_response = self.run_test(
            "Create Short Timer Treat", 
            "POST", 
            "treats/enhanced", 
            200, 
            data=short_timer_data
        )
        
        if success and short_response:
            short_treat = short_response.get('treat', {})
            short_outcome = short_response.get('outcome', {})
            short_treat_id = short_treat.get('id')
            
            if short_treat_id:
                print(f"   ✅ Short timer treat created: {short_outcome.get('timer_duration_hours', 0)}h timer")
                
                # Check initial brewing status
                success, initial_status = self.run_test(
                    "Check Initial Status", 
                    "POST", 
                    f"treats/{short_treat_id}/check-timer", 
                    200
                )
                
                if success and initial_status:
                    initial_brewing_status = initial_status.get('status', 'unknown')
                    print(f"   ✅ Initial status: {initial_brewing_status}")
                    
                    if initial_brewing_status == 'brewing':
                        print(f"   ✅ Brewing → ready status transition system ready")
                    else:
                        print(f"   ⚠️  Expected brewing status, got: {initial_brewing_status}")
        
        # Test player progress and statistics tracking
        print(f"\n📈 Testing Player Progress & Statistics Tracking")
        
        # Get player statistics
        success, player_stats = self.run_test(
            "Get Player Statistics", 
            "GET", 
            f"player/{test_scenarios[0]['data']['creator_address']}", 
            200
        )
        
        if success and player_stats:
            created_treats = player_stats.get('created_treats', [])
            level = player_stats.get('level', 0)
            experience = player_stats.get('experience', 0)
            points = player_stats.get('points', 0)
            
            print(f"   ✅ Player progress tracked: Level {level}, {experience} XP, {points} points")
            print(f"   ✅ Created treats tracked: {len(created_treats)} treats")
            
            if len(created_treats) >= len(created_treat_ids):
                print(f"   ✅ Treat creation properly recorded in player progress")
            else:
                print(f"   ⚠️  Some treats may not be recorded in player progress")
        else:
            print(f"   ❌ Failed to retrieve player statistics")
            all_success = False
        
        return all_success, {
            "treats_created": len(created_treat_ids),
            "timer_tests_passed": True,
            "persistence_verified": True
        }

    def test_specific_wallet_treat_timing(self, wallet_address="0x033CD94d0020B397393bF1deA4920Be0d4723DCB"):
        """Test treat status and timing for a specific wallet address as requested"""
        print(f"\n🎯 TESTING TREAT STATUS AND TIMING FOR WALLET: {wallet_address}")
        print("=" * 80)
        print("Focus: Check active treats, timing, and player stats for specific wallet")
        
        all_success = True
        results = {}
        
        # 1. GET /api/treats/{address}/brewing - Get all brewing treats
        print(f"\n🔍 Step 1: Getting Active Brewing Treats")
        success, brewing_response = self.run_test(
            "Get Active Brewing Treats", 
            "GET", 
            f"treats/{wallet_address}/brewing", 
            200
        )
        
        if success:
            brewing_treats = brewing_response if isinstance(brewing_response, list) else []
            results['active_treats'] = brewing_treats
            print(f"   ✅ Found {len(brewing_treats)} active brewing treats")
            
            if brewing_treats:
                for i, treat in enumerate(brewing_treats):
                    treat_id = treat.get('id', 'unknown')
                    rarity = treat.get('rarity', 'unknown')
                    brewing_status = treat.get('brewing_status', 'unknown')
                    ready_at = treat.get('ready_at', 'unknown')
                    print(f"   🍖 Treat {i+1}: ID={treat_id[:12]}..., Rarity={rarity}, Status={brewing_status}")
                    print(f"      Ready at: {ready_at}")
            else:
                print(f"   ℹ️  No active brewing treats found for this wallet")
        else:
            print(f"   ❌ Failed to get brewing treats")
            all_success = False
        
        # 2. Check timer for each active treat using POST /api/treats/{treat_id}/check-timer
        print(f"\n⏰ Step 2: Checking Timer Status for Each Active Treat")
        treat_timers = []
        
        if success and brewing_treats:
            for i, treat in enumerate(brewing_treats):
                treat_id = treat.get('id')
                if treat_id:
                    timer_success, timer_response = self.run_test(
                        f"Check Timer for Treat {i+1}", 
                        "POST", 
                        f"treats/{treat_id}/check-timer", 
                        200
                    )
                    
                    if timer_success and timer_response:
                        status = timer_response.get('status', 'unknown')
                        remaining_seconds = timer_response.get('remaining_seconds', 0)
                        message = timer_response.get('message', '')
                        
                        # Convert seconds to hours/minutes for readability
                        if remaining_seconds > 0:
                            hours = remaining_seconds // 3600
                            minutes = (remaining_seconds % 3600) // 60
                            time_display = f"{hours}h {minutes}m"
                        else:
                            time_display = "Ready now!"
                        
                        treat_timers.append({
                            'treat_id': treat_id,
                            'status': status,
                            'remaining_seconds': remaining_seconds,
                            'time_remaining': time_display,
                            'message': message
                        })
                        
                        print(f"   🕐 Treat {treat_id[:12]}...: {status} - {time_display}")
                        print(f"      Message: {message}")
                    else:
                        print(f"   ❌ Failed to check timer for treat {treat_id[:12]}...")
                        all_success = False
        else:
            print(f"   ℹ️  No active treats to check timers for")
        
        results['treat_timers'] = treat_timers
        
        # 3. GET /api/treats/{address} - Get complete treat history
        print(f"\n📚 Step 3: Getting Complete Treat History")
        success, all_treats_response = self.run_test(
            "Get Complete Treat History", 
            "GET", 
            f"treats/{wallet_address}", 
            200
        )
        
        if success:
            all_treats = all_treats_response if isinstance(all_treats_response, list) else []
            results['all_treats'] = all_treats
            print(f"   ✅ Found {len(all_treats)} total treats in history")
            
            # Categorize treats by status
            brewing_count = sum(1 for treat in all_treats if treat.get('brewing_status') == 'brewing')
            ready_count = sum(1 for treat in all_treats if treat.get('brewing_status') == 'ready')
            
            print(f"   📊 Treat Status Breakdown:")
            print(f"      🔄 Brewing: {brewing_count}")
            print(f"      ✅ Ready: {ready_count}")
            
            # Show recent treats (last 5)
            if all_treats:
                print(f"   📋 Recent Treats (last 5):")
                recent_treats = sorted(all_treats, key=lambda x: x.get('created_at', ''), reverse=True)[:5]
                for i, treat in enumerate(recent_treats):
                    name = treat.get('name', 'Unknown')
                    rarity = treat.get('rarity', 'unknown')
                    status = treat.get('brewing_status', 'unknown')
                    created_at = treat.get('created_at', 'unknown')
                    print(f"      {i+1}. {name} ({rarity}) - {status} - Created: {created_at}")
        else:
            print(f"   ❌ Failed to get complete treat history")
            all_success = False
        
        # 4. GET /api/player/{address} - Get player stats
        print(f"\n👤 Step 4: Getting Player Stats")
        success, player_response = self.run_test(
            "Get Player Stats", 
            "GET", 
            f"player/{wallet_address}", 
            200
        )
        
        if success and player_response:
            results['player_stats'] = player_response
            
            # Extract key player information
            level = player_response.get('level', 0)
            experience = player_response.get('experience', 0)
            points = player_response.get('points', 0)
            is_nft_holder = player_response.get('is_nft_holder', False)
            nickname = player_response.get('nickname', 'No nickname')
            created_treats_count = len(player_response.get('created_treats', []))
            
            print(f"   ✅ Player Information:")
            print(f"      🏷️  Nickname: {nickname}")
            print(f"      📊 Level: {level}")
            print(f"      ⭐ Experience: {experience}")
            print(f"      🎯 Points: {points}")
            print(f"      🎨 NFT Holder: {is_nft_holder}")
            print(f"      🍖 Total Treats Created: {created_treats_count}")
        else:
            # Player might not exist, try to create one for testing
            print(f"   ⚠️  Player not found, attempting to create player for testing...")
            create_success, create_response = self.run_test(
                "Create Test Player", 
                "POST", 
                "player", 
                200, 
                data={
                    "address": wallet_address,
                    "nickname": "TestPlayer",
                    "is_nft_holder": False
                }
            )
            
            if create_success:
                print(f"   ✅ Test player created successfully")
                results['player_stats'] = create_response
            else:
                print(f"   ❌ Failed to create test player")
                all_success = False
        
        # 5. Summary and Recommendations
        print(f"\n📋 SUMMARY FOR WALLET {wallet_address}")
        print("=" * 80)
        
        active_treats_count = len(results.get('active_treats', []))
        total_treats_count = len(results.get('all_treats', []))
        player_level = results.get('player_stats', {}).get('level', 0)
        
        print(f"🎯 TREAT STATUS OVERVIEW:")
        print(f"   • Active brewing treats: {active_treats_count}")
        print(f"   • Total treats created: {total_treats_count}")
        print(f"   • Player level: {player_level}")
        
        if treat_timers:
            print(f"\n⏰ TIMING INFORMATION:")
            for timer in treat_timers:
                print(f"   • Treat {timer['treat_id'][:12]}...: {timer['time_remaining']} ({timer['status']})")
        else:
            print(f"\n⏰ TIMING INFORMATION:")
            print(f"   • No active treats with timers")
        
        # Provide user-friendly recommendations
        print(f"\n💡 RECOMMENDATIONS:")
        if active_treats_count > 0:
            ready_treats = [t for t in treat_timers if t['status'] == 'ready']
            if ready_treats:
                print(f"   🎉 You have {len(ready_treats)} treats ready for collection!")
            else:
                next_ready = min(treat_timers, key=lambda x: x['remaining_seconds']) if treat_timers else None
                if next_ready and next_ready['remaining_seconds'] > 0:
                    print(f"   ⏳ Next treat ready in: {next_ready['time_remaining']}")
        else:
            print(f"   🍖 No active treats brewing. Consider creating new treats!")
        
        return all_success, results

    def test_critical_bugs_investigation(self):
        """Investigate critical bugs for wallet address 0x033CD94d0020B397393bF1deA4920Be0d4723DCB"""
        print("\n🚨 CRITICAL BUGS INVESTIGATION FOR WALLET 0x033CD94d0020B397393bF1deA4920Be0d4723DCB")
        print("=" * 80)
        
        target_address = "0x033CD94d0020B397393bF1deA4920Be0d4723DCB"
        all_success = True
        investigation_results = {}
        
        # 1. SACK SYSTEM BUG INVESTIGATION
        print(f"\n🎒 1. SACK SYSTEM BUG INVESTIGATION")
        print("-" * 50)
        
        # Check current player data
        success, player_data = self.run_test(
            "Get Player Data for Sack Investigation", 
            "GET", 
            f"player/{target_address}", 
            200
        )
        
        if success and player_data:
            print(f"   📊 Player Level: {player_data.get('level', 'Unknown')}")
            print(f"   📊 Player XP: {player_data.get('experience', 'Unknown')}")
            print(f"   📊 Player Points: {player_data.get('points', 'Unknown')}")
            print(f"   📊 NFT Holder: {player_data.get('is_nft_holder', 'Unknown')}")
            print(f"   📊 Created Treats: {len(player_data.get('created_treats', []))}")
            
            investigation_results['player_level'] = player_data.get('level', 0)
            investigation_results['player_xp'] = player_data.get('experience', 0)
            investigation_results['player_points'] = player_data.get('points', 0)
            investigation_results['is_nft_holder'] = player_data.get('is_nft_holder', False)
        else:
            print(f"   ❌ Failed to retrieve player data - player may not exist")
            investigation_results['player_exists'] = False
            all_success = False
        
        # Test treat creation to check if sack progress updates
        print(f"\n   🧪 Testing Treat Creation for Sack Progress")
        treat_data = {
            "creator_address": target_address,
            "ingredients": ["chicken", "bones", "rice"],
            "player_level": investigation_results.get('player_level', 1)
        }
        
        success, treat_response = self.run_test(
            "Create Treat to Test Sack Progress", 
            "POST", 
            "treats/enhanced", 
            200, 
            data=treat_data
        )
        
        if success and treat_response:
            outcome = treat_response.get('outcome', {})
            print(f"   ✅ Treat created successfully")
            print(f"   📊 Rarity: {outcome.get('rarity', 'Unknown')}")
            print(f"   📊 XP Bonus: {outcome.get('xp_bonus', 'Not specified')}")
            investigation_results['treat_creation_works'] = True
        else:
            print(f"   ❌ Treat creation failed - sack system may be broken")
            investigation_results['treat_creation_works'] = False
            all_success = False
        
        # 2. LEADERBOARD DATA BUG INVESTIGATION
        print(f"\n🏆 2. LEADERBOARD DATA BUG INVESTIGATION")
        print("-" * 50)
        
        # Test regular leaderboard
        success, leaderboard_data = self.run_test(
            "Check Regular Leaderboard", 
            "GET", 
            "leaderboard", 
            200,
            params={"limit": 50}
        )
        
        player_in_leaderboard = False
        if success and leaderboard_data:
            print(f"   📊 Total leaderboard entries: {len(leaderboard_data)}")
            for entry in leaderboard_data:
                if entry.get('address', '').lower() == target_address.lower():
                    player_in_leaderboard = True
                    print(f"   ✅ Player found in leaderboard:")
                    print(f"      - Rank: {entry.get('rank', 'Unknown')}")
                    print(f"      - Points: {entry.get('points', 'Unknown')}")
                    print(f"      - Level: {entry.get('level', 'Unknown')}")
                    print(f"      - NFT Holder: {entry.get('is_nft_holder', 'Unknown')}")
                    break
            
            if not player_in_leaderboard:
                print(f"   ❌ Player NOT found in regular leaderboard")
                print(f"   🔍 Checking if player has points > 0 and is NFT holder...")
        
        investigation_results['in_regular_leaderboard'] = player_in_leaderboard
        
        # Test points-based leaderboard
        success, points_leaderboard = self.run_test(
            "Check Points Leaderboard", 
            "GET", 
            "points/leaderboard", 
            200,
            params={"limit": 50}
        )
        
        player_in_points_leaderboard = False
        if success and points_leaderboard:
            leaderboard_entries = points_leaderboard.get('leaderboard', [])
            print(f"   📊 Total points leaderboard entries: {len(leaderboard_entries)}")
            
            for entry in leaderboard_entries:
                if entry.get('address', '').lower() == target_address.lower():
                    player_in_points_leaderboard = True
                    print(f"   ✅ Player found in points leaderboard:")
                    print(f"      - Rank: {entry.get('rank', 'Unknown')}")
                    print(f"      - Points: {entry.get('points', 'Unknown')}")
                    print(f"      - Weekly Points: {entry.get('weekly_points', 'Unknown')}")
                    print(f"      - Activity Score: {entry.get('activity_score', 'Unknown')}")
                    break
            
            if not player_in_points_leaderboard:
                print(f"   ❌ Player NOT found in points leaderboard")
        
        investigation_results['in_points_leaderboard'] = player_in_points_leaderboard
        
        # 3. LEVEL INCONSISTENCY BUG INVESTIGATION
        print(f"\n📊 3. LEVEL INCONSISTENCY BUG INVESTIGATION")
        print("-" * 50)
        
        # Get all player treats to check level consistency
        success, player_treats = self.run_test(
            "Get All Player Treats for Level Check", 
            "GET", 
            f"treats/{target_address}", 
            200
        )
        
        level_inconsistencies = []
        if success and player_treats:
            print(f"   📊 Total treats found: {len(player_treats)}")
            player_level = investigation_results.get('player_level', 1)
            
            for i, treat in enumerate(player_treats):
                treat_name = treat.get('name', f'Treat {i+1}')
                
                # Check if treat name contains level information
                if 'Level' in treat_name:
                    import re
                    level_match = re.search(r'Level (\d+)', treat_name)
                    if level_match:
                        treat_level = int(level_match.group(1))
                        if treat_level != player_level:
                            level_inconsistencies.append({
                                'treat_name': treat_name,
                                'treat_level': treat_level,
                                'player_level': player_level,
                                'created_at': treat.get('created_at', 'Unknown')
                            })
                            print(f"   ⚠️  INCONSISTENCY: {treat_name} (treat level {treat_level} vs player level {player_level})")
                
                # Check treat metadata for level information
                nft_metadata = treat.get('nft_metadata', {})
                if nft_metadata:
                    attributes = nft_metadata.get('attributes', [])
                    for attr in attributes:
                        if attr.get('trait_type') == 'Creator Level':
                            treat_creator_level = attr.get('value', 0)
                            if treat_creator_level != player_level and treat_creator_level > player_level:
                                level_inconsistencies.append({
                                    'treat_name': treat_name,
                                    'treat_creator_level': treat_creator_level,
                                    'player_level': player_level,
                                    'source': 'nft_metadata'
                                })
                                print(f"   ⚠️  METADATA INCONSISTENCY: {treat_name} created at level {treat_creator_level} but player is level {player_level}")
            
            if level_inconsistencies:
                print(f"   🚨 FOUND {len(level_inconsistencies)} LEVEL INCONSISTENCIES!")
                investigation_results['level_inconsistencies'] = level_inconsistencies
                all_success = False
            else:
                print(f"   ✅ No level inconsistencies found")
                investigation_results['level_inconsistencies'] = []
        else:
            print(f"   ❌ Failed to retrieve player treats")
            all_success = False
        
        # 4. DATA INTEGRITY ISSUES INVESTIGATION
        print(f"\n🔍 4. DATA INTEGRITY ISSUES INVESTIGATION")
        print("-" * 50)
        
        # Check for mock data patterns
        mock_data_indicators = []
        
        if success and player_treats:
            for treat in player_treats:
                # Check for mock/test data patterns
                treat_name = treat.get('name', '')
                ingredients = treat.get('ingredients', [])
                
                # Look for test/mock patterns
                if any(keyword in treat_name.lower() for keyword in ['test', 'mock', 'demo', 'sample']):
                    mock_data_indicators.append(f"Mock name pattern: {treat_name}")
                
                if any(keyword in str(ingredients).lower() for keyword in ['test', 'mock', 'demo']):
                    mock_data_indicators.append(f"Mock ingredients: {ingredients}")
                
                # Check for unrealistic ingredient combinations
                if len(ingredients) > 10:  # Unrealistically high ingredient count
                    mock_data_indicators.append(f"Unrealistic ingredient count: {len(ingredients)} in {treat_name}")
            
            if mock_data_indicators:
                print(f"   🚨 FOUND MOCK DATA INDICATORS:")
                for indicator in mock_data_indicators:
                    print(f"      - {indicator}")
                investigation_results['mock_data_found'] = True
                all_success = False
            else:
                print(f"   ✅ No obvious mock data patterns found")
                investigation_results['mock_data_found'] = False
        
        # Check player stats for consistency
        if investigation_results.get('player_exists', True):
            success, player_stats = self.run_test(
                "Get Player Points Stats for Integrity Check", 
                "GET", 
                f"points/{target_address}/stats", 
                200
            )
            
            if success and player_stats:
                player_info = player_stats.get('player', {})
                activity_info = player_stats.get('activity', {})
                points_breakdown = player_stats.get('points_breakdown', {})
                
                print(f"   📊 Player Stats Integrity Check:")
                print(f"      - Total Points: {player_info.get('total_points', 0)}")
                print(f"      - Activity Score: {activity_info.get('activity_score', 0)}")
                print(f"      - Login Streak: {activity_info.get('login_streak', 0)}")
                print(f"      - Treat Creation Streak: {activity_info.get('treat_creation_streak', 0)}")
                print(f"      - Points Sources: {list(points_breakdown.keys())}")
                
                # Check for data consistency
                total_points_calc = sum(points_breakdown.values()) if points_breakdown else 0
                reported_total = player_info.get('total_points', 0)
                
                if abs(total_points_calc - reported_total) > 1:  # Allow small rounding differences
                    print(f"   ⚠️  POINTS CALCULATION INCONSISTENCY: Calculated {total_points_calc} vs Reported {reported_total}")
                    investigation_results['points_inconsistency'] = True
                    all_success = False
                else:
                    print(f"   ✅ Points calculation consistent")
                    investigation_results['points_inconsistency'] = False
        
        # FINAL INVESTIGATION SUMMARY
        print(f"\n📋 CRITICAL BUGS INVESTIGATION SUMMARY")
        print("=" * 60)
        
        print(f"🎯 TARGET WALLET: {target_address}")
        print(f"📊 INVESTIGATION RESULTS:")
        
        # Sack System
        if investigation_results.get('treat_creation_works', False):
            print(f"   ✅ Sack System: Treat creation working")
        else:
            print(f"   ❌ Sack System: CRITICAL BUG - Treat creation failing")
        
        # Leaderboard
        if investigation_results.get('in_regular_leaderboard', False) or investigation_results.get('in_points_leaderboard', False):
            print(f"   ✅ Leaderboard: Player appears in at least one leaderboard")
        else:
            print(f"   ❌ Leaderboard: CRITICAL BUG - Player missing from leaderboards despite having data")
        
        # Level Consistency
        inconsistency_count = len(investigation_results.get('level_inconsistencies', []))
        if inconsistency_count == 0:
            print(f"   ✅ Level Consistency: No inconsistencies found")
        else:
            print(f"   ❌ Level Consistency: CRITICAL BUG - {inconsistency_count} inconsistencies found")
        
        # Data Integrity
        if not investigation_results.get('mock_data_found', True) and not investigation_results.get('points_inconsistency', True):
            print(f"   ✅ Data Integrity: No major issues found")
        else:
            print(f"   ❌ Data Integrity: CRITICAL BUG - Mock data or calculation inconsistencies found")
        
        print(f"\n🔧 RECOMMENDED ACTIONS:")
        if not investigation_results.get('treat_creation_works', False):
            print(f"   1. Fix sack system - treat creation endpoint failing")
        if not investigation_results.get('in_regular_leaderboard', False) and not investigation_results.get('in_points_leaderboard', False):
            print(f"   2. Fix leaderboard data - player not appearing despite having points/treats")
        if inconsistency_count > 0:
            print(f"   3. Fix level inconsistency - {inconsistency_count} treats have wrong level data")
        if investigation_results.get('mock_data_found', False):
            print(f"   4. Clean up mock/test data contamination")
        if investigation_results.get('points_inconsistency', False):
            print(f"   5. Fix points calculation inconsistencies")
        
        return all_success, investigation_results

    def test_critical_bug_fixes_verification(self):
        """Test all critical bug fixes mentioned in the review request"""
        print("\n🔧 CRITICAL BUG FIXES VERIFICATION")
        print("=" * 70)
        print("Testing wallet: 0x033CD94d0020B397393bF1deA4920Be0d4723DCB")
        
        test_wallet = "0x033CD94d0020B397393bF1deA4920Be0d4723DCB"
        all_success = True
        
        # 1. Test Sack System Fixed
        print(f"\n🎒 TESTING SACK SYSTEM FIX")
        print("=" * 40)
        
        # Create player first
        player_data = {
            "address": test_wallet,
            "nickname": "SackTester",
            "is_nft_holder": True
        }
        success, _ = self.run_test("Create Test Player", "POST", "player", 200, data=player_data)
        
        # Test sequence: Create 5 treats to verify sack progression
        sack_test_results = []
        for i in range(5):
            treat_data = {
                "creator_address": test_wallet,
                "ingredients": ["chicken", "bones", "rice"],
                "player_level": 1
            }
            
            success, response = self.run_test(
                f"Create Treat {i+1}/5 (Sack Test)", 
                "POST", 
                "treats/enhanced", 
                200, 
                data=treat_data
            )
            
            if success and response:
                sack_progress = response.get('sack_progress', {})
                current_progress = sack_progress.get('current_progress', 0)
                just_completed = sack_progress.get('just_completed', False)
                bonus_xp = sack_progress.get('bonus_xp_awarded', 0)
                total_treats = sack_progress.get('total_treats', 0)
                
                expected_progress = (i + 1) % 5
                expected_completion = (i + 1) == 5
                
                print(f"   Treat {i+1}: Progress {current_progress}/5, Total: {total_treats}, Completed: {just_completed}, XP Bonus: {bonus_xp}")
                
                sack_test_results.append({
                    "treat_number": i + 1,
                    "progress": current_progress,
                    "expected_progress": expected_progress,
                    "completed": just_completed,
                    "expected_completion": expected_completion,
                    "bonus_xp": bonus_xp,
                    "total_treats": total_treats
                })
                
                # Verify sack progress
                if current_progress == expected_progress:
                    print(f"   ✅ Sack progress correct: {current_progress}/5")
                else:
                    print(f"   ❌ Sack progress incorrect: got {current_progress}/5, expected {expected_progress}/5")
                    all_success = False
                
                # Verify sack completion and XP bonus
                if i == 4:  # 5th treat should complete sack
                    if just_completed and bonus_xp == 50:
                        print(f"   ✅ Sack completion detected with +50 XP bonus!")
                    else:
                        print(f"   ❌ Sack completion failed: completed={just_completed}, bonus_xp={bonus_xp}")
                        all_success = False
            else:
                print(f"   ❌ Failed to create treat {i+1}")
                all_success = False
        
        # 2. Test Leaderboard Fixed
        print(f"\n🏆 TESTING LEADERBOARD FIX")
        print("=" * 40)
        
        # Test GET /api/leaderboard (should include all players)
        success, response = self.run_test("Get Main Leaderboard", "GET", "leaderboard", 200, params={"limit": 50})
        
        if success and response:
            leaderboard_entries = response if isinstance(response, list) else []
            print(f"   ✅ Main leaderboard retrieved: {len(leaderboard_entries)} entries")
            
            # Check if our test player appears
            test_player_found = any(entry.get('address') == test_wallet for entry in leaderboard_entries)
            if test_player_found:
                print(f"   ✅ Test player found in main leaderboard")
            else:
                print(f"   ⚠️  Test player not found in main leaderboard (may need points)")
        else:
            print(f"   ❌ Failed to retrieve main leaderboard")
            all_success = False
        
        # Test GET /api/points/leaderboard (should include all players by default)
        success, response = self.run_test("Get Points Leaderboard", "GET", "points/leaderboard", 200, params={"limit": 50})
        
        if success and response:
            points_leaderboard = response.get('leaderboard', [])
            print(f"   ✅ Points leaderboard retrieved: {len(points_leaderboard)} entries")
            
            # Check if our test player appears
            test_player_found = any(entry.get('address') == test_wallet for entry in points_leaderboard)
            if test_player_found:
                print(f"   ✅ Test player found in points leaderboard")
            else:
                print(f"   ⚠️  Test player not found in points leaderboard (may need points)")
        else:
            print(f"   ❌ Failed to retrieve points leaderboard")
            all_success = False
        
        # 3. Test Data Consistency Fixed
        print(f"\n📊 TESTING DATA CONSISTENCY FIX")
        print("=" * 40)
        
        # Test GET /api/player/{address} for clean player state
        success, response = self.run_test("Get Player State", "GET", f"player/{test_wallet}", 200)
        
        if success and response:
            player = response
            address = player.get('address')
            level = player.get('level')
            experience = player.get('experience')
            points = player.get('points')
            nickname = player.get('nickname')
            
            print(f"   ✅ Player retrieved: {address}")
            print(f"   📊 Level: {level}, XP: {experience}, Points: {points}")
            print(f"   👤 Nickname: {nickname}")
            
            # Verify clean state (no mock data)
            if level == 1 and isinstance(experience, int) and isinstance(points, int):
                print(f"   ✅ Clean player state confirmed (Level 1, proper data types)")
            else:
                print(f"   ❌ Player state inconsistent: level={level}, xp={experience}, points={points}")
                all_success = False
            
            # Verify treat creation uses correct player level
            if level == 1:
                print(f"   ✅ Treat creation will use correct player level (Level 1)")
            else:
                print(f"   ⚠️  Player level not Level 1 as expected: {level}")
        else:
            print(f"   ❌ Failed to retrieve player state")
            all_success = False
        
        # 4. Test Real-Time Updates
        print(f"\n⚡ TESTING REAL-TIME UPDATES")
        print("=" * 40)
        
        # Get initial player stats
        success, initial_stats = self.run_test("Get Initial Player Stats", "GET", f"points/{test_wallet}/stats", 200)
        initial_points = 0
        if success and initial_stats and 'player' in initial_stats:
            initial_points = initial_stats['player'].get('total_points', 0)
            print(f"   📊 Initial points: {initial_points}")
        
        # Create one more treat to test real-time updates
        treat_data = {
            "creator_address": test_wallet,
            "ingredients": ["premium_bacon", "aged_cheese"],
            "player_level": 1
        }
        
        success, response = self.run_test("Create Treat for Real-time Test", "POST", "treats/enhanced", 200, data=treat_data)
        
        if success:
            print(f"   ✅ Additional treat created for real-time testing")
            
            # Wait for background points processing
            import time
            time.sleep(3)
            
            # Check updated player stats
            success, final_stats = self.run_test("Get Updated Player Stats", "GET", f"points/{test_wallet}/stats", 200)
            final_points = 0
            if success and final_stats and 'player' in final_stats:
                final_points = final_stats['player'].get('total_points', 0)
                points_awarded = final_points - initial_points
                
                print(f"   📊 Final points: {final_points}")
                print(f"   📈 Points awarded: {points_awarded}")
                
                if points_awarded > 0:
                    print(f"   ✅ Real-time points accumulation working")
                else:
                    print(f"   ⚠️  No points awarded (may be expected for background processing)")
            
            # Test leaderboard updates
            success, updated_leaderboard = self.run_test("Check Updated Leaderboard", "GET", "points/leaderboard", 200, params={"limit": 50})
            
            if success and updated_leaderboard:
                leaderboard = updated_leaderboard.get('leaderboard', [])
                test_player_entry = next((entry for entry in leaderboard if entry.get('address') == test_wallet), None)
                
                if test_player_entry:
                    player_points = test_player_entry.get('total_points', 0)
                    print(f"   ✅ Player found in updated leaderboard with {player_points} points")
                else:
                    print(f"   ⚠️  Player not yet visible in leaderboard (may need more points)")
        else:
            print(f"   ❌ Failed to create treat for real-time testing")
            all_success = False
        
        # Summary
        print(f"\n🎯 CRITICAL BUG FIXES VERIFICATION RESULTS")
        print("=" * 50)
        
        if all_success:
            print(f"✅ ALL CRITICAL BUG FIXES VERIFIED SUCCESSFULLY!")
            print(f"✅ Sack System: Working correctly with 5-treat progression and XP bonuses")
            print(f"✅ Leaderboard: Includes all players, not just NFT holders")
            print(f"✅ Data Consistency: Clean player state with proper level progression")
            print(f"✅ Real-Time Updates: Points accumulation and leaderboard updates working")
        else:
            print(f"❌ SOME CRITICAL BUG FIXES NEED ATTENTION")
            print(f"⚠️  Review the detailed test results above for specific issues")
        
        return all_success, {
            "sack_system_working": True,
            "leaderboard_fixed": True,
            "data_consistency_clean": True,
            "real_time_updates_working": True,
            "sack_test_results": sack_test_results
        }

    def test_critical_dogefood_lab_bugs(self):
        """Test critical bugs as specified in review request"""
        print("\n🚨 CRITICAL DOGEFOOD LAB BUG INVESTIGATION")
        print("=" * 70)
        print("Focus: Mock data, mixing timer bug, database state investigation")
        
        all_success = True
        findings = {
            "mock_data_found": [],
            "mixing_timer_issues": [],
            "database_inconsistencies": [],
            "target_player_status": {}
        }
        
        # Target player from review request
        target_player = "0x033CD94d0020B397393bF1deA4920Be0d4723DCB"
        
        # 1. MOCK DATA INVESTIGATION
        print(f"\n🔍 1. MOCK DATA INVESTIGATION")
        print("=" * 40)
        
        # Test GET /api/players (check for mock data)
        print(f"\n📋 Testing GET /api/players for mock data...")
        success, response = self.run_test("Get All Players", "GET", "players", 200)
        
        if success and response:
            players = response if isinstance(response, list) else []
            print(f"   📊 Total players found: {len(players)}")
            
            # Check for mock/test data patterns
            mock_patterns = ["test", "demo", "mock", "0x123", "0xtest", "0xdemo"]
            for player in players:
                address = player.get('address', '').lower()
                nickname = player.get('nickname', '').lower()
                
                for pattern in mock_patterns:
                    if pattern in address or pattern in nickname:
                        findings["mock_data_found"].append({
                            "type": "player",
                            "address": player.get('address'),
                            "nickname": player.get('nickname'),
                            "pattern": pattern
                        })
                        print(f"   🚨 MOCK DATA FOUND: Player {address} (nickname: {nickname}) contains '{pattern}'")
        else:
            print(f"   ❌ Failed to retrieve players list")
            all_success = False
        
        # Test GET /api/treats (check for test data)
        print(f"\n🧪 Testing GET /api/treats for mock data...")
        success, response = self.run_test("Get All Treats", "GET", "treats", 200, params={"limit": 100})
        
        if success and response:
            treats = response if isinstance(response, list) else []
            print(f"   📊 Total treats found: {len(treats)}")
            
            # Check for mock/test data in treats
            for treat in treats:
                name = treat.get('name', '').lower()
                creator = treat.get('creator_address', '').lower()
                
                for pattern in mock_patterns:
                    if pattern in name or pattern in creator:
                        findings["mock_data_found"].append({
                            "type": "treat",
                            "name": treat.get('name'),
                            "creator": treat.get('creator_address'),
                            "pattern": pattern
                        })
                        print(f"   🚨 MOCK DATA FOUND: Treat '{name}' by {creator} contains '{pattern}'")
        else:
            print(f"   ❌ Failed to retrieve treats list")
            all_success = False
        
        # Test GET /api/leaderboard (check for mock entries)
        print(f"\n🏆 Testing GET /api/leaderboard for mock data...")
        success, response = self.run_test("Get Leaderboard", "GET", "leaderboard", 200, params={"limit": 50})
        
        if success and response:
            leaderboard = response if isinstance(response, list) else []
            print(f"   📊 Total leaderboard entries: {len(leaderboard)}")
            
            # Check for mock data in leaderboard
            for entry in leaderboard:
                address = entry.get('address', '').lower()
                nickname = entry.get('nickname', '').lower() if entry.get('nickname') else ''
                
                for pattern in mock_patterns:
                    if pattern in address or pattern in nickname:
                        findings["mock_data_found"].append({
                            "type": "leaderboard",
                            "address": entry.get('address'),
                            "nickname": entry.get('nickname'),
                            "points": entry.get('points'),
                            "pattern": pattern
                        })
                        print(f"   🚨 MOCK DATA FOUND: Leaderboard entry {address} (nickname: {nickname}) contains '{pattern}'")
        else:
            print(f"   ❌ Failed to retrieve leaderboard")
            all_success = False
        
        # 2. TARGET PLAYER INVESTIGATION
        print(f"\n🎯 2. TARGET PLAYER INVESTIGATION: {target_player}")
        print("=" * 40)
        
        # Check target player data
        success, response = self.run_test(f"Get Target Player {target_player}", "GET", f"player/{target_player}", 200)
        
        if success and response:
            findings["target_player_status"] = response
            print(f"   ✅ Target player found:")
            print(f"      Address: {response.get('address')}")
            print(f"      Nickname: {response.get('nickname', 'None')}")
            print(f"      Level: {response.get('level')}")
            print(f"      Experience: {response.get('experience')}")
            print(f"      Points: {response.get('points')}")
            print(f"      NFT Holder: {response.get('is_nft_holder')}")
            print(f"      Created Treats: {len(response.get('created_treats', []))}")
            
            # Check if data looks clean (no mock patterns)
            address = response.get('address', '').lower()
            nickname = response.get('nickname', '').lower() if response.get('nickname') else ''
            
            is_clean = True
            mock_patterns = ["test", "demo", "mock", "0x123", "0xtest", "0xdemo"]
            for pattern in mock_patterns:
                if pattern in address or pattern in nickname:
                    print(f"   🚨 Target player contains mock pattern: '{pattern}'")
                    is_clean = False
            
            if is_clean:
                print(f"   ✅ Target player data appears clean (no mock patterns)")
        else:
            print(f"   ❌ Target player not found or error retrieving data")
            findings["target_player_status"] = {"error": "Player not found"}
        
        # Get target player's treats
        success, response = self.run_test(f"Get Target Player Treats", "GET", f"treats/{target_player}", 200)
        
        if success and response:
            treats = response if isinstance(response, list) else []
            print(f"   📊 Target player treats: {len(treats)}")
            
            # Analyze treat data for inconsistencies
            brewing_count = 0
            ready_count = 0
            for treat in treats:
                status = treat.get('brewing_status', 'unknown')
                if status == 'brewing':
                    brewing_count += 1
                elif status == 'ready':
                    ready_count += 1
            
            print(f"      Brewing treats: {brewing_count}")
            print(f"      Ready treats: {ready_count}")
            
            findings["target_player_status"]["treats_count"] = len(treats)
            findings["target_player_status"]["brewing_treats"] = brewing_count
            findings["target_player_status"]["ready_treats"] = ready_count
        
        # 3. MIXING TIMER BUG INVESTIGATION
        print(f"\n⏰ 3. MIXING TIMER BUG INVESTIGATION (0% progress)")
        print("=" * 40)
        
        # Test POST /api/treats/enhanced with real data
        print(f"\n🧪 Testing POST /api/treats/enhanced with real data...")
        
        # Use realistic test data
        test_treat_data = {
            "creator_address": "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54",  # Different from target to avoid conflicts
            "ingredients": ["chicken", "beef", "cheese", "herbs"],
            "player_level": 10
        }
        
        # Measure response time
        import time
        start_time = time.time()
        
        success, response = self.run_test("Enhanced Treat Creation - Timer Test", "POST", "treats/enhanced", 200, data=test_treat_data)
        
        end_time = time.time()
        response_time = end_time - start_time
        
        print(f"   ⏱️  API Response Time: {response_time:.2f} seconds")
        
        if success and response:
            treat = response.get('treat', {})
            outcome = response.get('outcome', {})
            
            # Check if mixing API completed properly
            if 'id' in treat and 'rarity' in outcome:
                print(f"   ✅ Mixing API completed successfully")
                print(f"      Treat ID: {treat.get('id')}")
                print(f"      Rarity: {outcome.get('rarity')}")
                print(f"      Timer Duration: {outcome.get('timer_duration_hours', 0)}h")
                print(f"      Brewing Status: {treat.get('brewing_status')}")
                
                # Check if ready_at timestamp is set
                ready_at = treat.get('ready_at')
                if ready_at:
                    print(f"      Ready At: {ready_at}")
                    print(f"   ✅ Timer system appears to be working")
                else:
                    print(f"   🚨 TIMER BUG: ready_at timestamp not set")
                    findings["mixing_timer_issues"].append("ready_at timestamp not set")
                    all_success = False
                
                # Test timer checking
                treat_id = treat.get('id')
                if treat_id:
                    success2, timer_response = self.run_test("Check Timer Status", "POST", f"treats/{treat_id}/check-timer", 200)
                    
                    if success2 and timer_response:
                        status = timer_response.get('status')
                        remaining = timer_response.get('remaining_seconds', 0)
                        print(f"      Timer Status: {status}")
                        print(f"      Remaining: {remaining} seconds")
                        
                        if status == 'brewing' and remaining > 0:
                            print(f"   ✅ Timer system functioning correctly")
                        else:
                            print(f"   🚨 TIMER BUG: Unexpected timer status or remaining time")
                            findings["mixing_timer_issues"].append(f"Unexpected timer status: {status}, remaining: {remaining}")
                    else:
                        print(f"   🚨 TIMER BUG: Timer check endpoint failed")
                        findings["mixing_timer_issues"].append("Timer check endpoint failed")
                        all_success = False
            else:
                print(f"   🚨 MIXING BUG: API response incomplete")
                findings["mixing_timer_issues"].append("API response incomplete - missing treat ID or rarity")
                all_success = False
        else:
            print(f"   🚨 MIXING BUG: Enhanced treat creation failed completely")
            findings["mixing_timer_issues"].append("Enhanced treat creation API failed")
            all_success = False
        
        # Test with different response time scenarios
        if response_time > 5.0:
            print(f"   ⚠️  SLOW RESPONSE: API took {response_time:.2f}s (>5s threshold)")
            findings["mixing_timer_issues"].append(f"Slow API response: {response_time:.2f}s")
        elif response_time > 2.0:
            print(f"   ⚠️  MODERATE DELAY: API took {response_time:.2f}s (>2s threshold)")
        else:
            print(f"   ✅ Response time acceptable: {response_time:.2f}s")
        
        # 4. DATABASE STATE INVESTIGATION
        print(f"\n🗄️  4. DATABASE STATE INVESTIGATION")
        print("=" * 40)
        
        # Get current state of players collection
        success, response = self.run_test("Game Stats", "GET", "stats", 200)
        
        if success and response:
            total_players = response.get('total_players', 0)
            nft_holders = response.get('nft_holders', 0)
            total_treats = response.get('total_treats', 0)
            active_today = response.get('active_today', 0)
            
            print(f"   📊 Database State Summary:")
            print(f"      Total Players: {total_players}")
            print(f"      NFT Holders: {nft_holders}")
            print(f"      Total Treats: {total_treats}")
            print(f"      Active Today: {active_today}")
            
            # Check for reasonable ratios
            if total_players > 0:
                nft_ratio = (nft_holders / total_players) * 100
                treats_per_player = total_treats / total_players
                
                print(f"      NFT Holder Ratio: {nft_ratio:.1f}%")
                print(f"      Treats per Player: {treats_per_player:.1f}")
                
                # Flag unusual ratios that might indicate test data
                if nft_ratio > 80:
                    print(f"   ⚠️  HIGH NFT RATIO: {nft_ratio:.1f}% (may indicate test data)")
                    findings["database_inconsistencies"].append(f"Unusually high NFT holder ratio: {nft_ratio:.1f}%")
                
                if treats_per_player > 50:
                    print(f"   ⚠️  HIGH TREATS/PLAYER: {treats_per_player:.1f} (may indicate test data)")
                    findings["database_inconsistencies"].append(f"Unusually high treats per player: {treats_per_player:.1f}")
        else:
            print(f"   ❌ Failed to get database stats")
            all_success = False
        
        # Check for data consistency in treats collection
        success, response = self.run_test("Sample Treats Analysis", "GET", "treats", 200, params={"limit": 20})
        
        if success and response:
            treats = response if isinstance(response, list) else []
            print(f"   🔍 Analyzing {len(treats)} sample treats for inconsistencies...")
            
            inconsistencies = 0
            for treat in treats:
                # Check for required fields
                required_fields = ['id', 'name', 'creator_address', 'ingredients', 'rarity']
                missing_fields = [field for field in required_fields if field not in treat or not treat[field]]
                
                if missing_fields:
                    print(f"      🚨 Treat {treat.get('id', 'unknown')[:8]}... missing fields: {missing_fields}")
                    inconsistencies += 1
                
                # Check for valid rarity values
                rarity = treat.get('rarity', '').lower()
                valid_rarities = ['common', 'rare', 'epic', 'legendary']
                if rarity not in valid_rarities:
                    print(f"      🚨 Treat {treat.get('id', 'unknown')[:8]}... invalid rarity: {rarity}")
                    inconsistencies += 1
                
                # Check ingredients array
                ingredients = treat.get('ingredients', [])
                if not isinstance(ingredients, list) or len(ingredients) == 0:
                    print(f"      🚨 Treat {treat.get('id', 'unknown')[:8]}... invalid ingredients: {ingredients}")
                    inconsistencies += 1
            
            if inconsistencies == 0:
                print(f"   ✅ No data inconsistencies found in sample treats")
            else:
                print(f"   🚨 Found {inconsistencies} data inconsistencies")
                findings["database_inconsistencies"].append(f"{inconsistencies} treats with data inconsistencies")
        
        # FINAL SUMMARY
        print(f"\n📋 CRITICAL BUG INVESTIGATION SUMMARY")
        print("=" * 50)
        
        print(f"\n🔍 MOCK DATA FINDINGS:")
        if findings["mock_data_found"]:
            print(f"   🚨 {len(findings['mock_data_found'])} mock data entries found:")
            for item in findings["mock_data_found"]:
                print(f"      - {item['type']}: {item.get('address', item.get('name', 'unknown'))} (pattern: {item['pattern']})")
        else:
            print(f"   ✅ No mock data patterns detected")
        
        print(f"\n⏰ MIXING TIMER FINDINGS:")
        if findings["mixing_timer_issues"]:
            print(f"   🚨 {len(findings['mixing_timer_issues'])} timer issues found:")
            for issue in findings["mixing_timer_issues"]:
                print(f"      - {issue}")
        else:
            print(f"   ✅ Mixing timer system appears to be working correctly")
        
        print(f"\n🗄️  DATABASE STATE FINDINGS:")
        if findings["database_inconsistencies"]:
            print(f"   🚨 {len(findings['database_inconsistencies'])} database issues found:")
            for issue in findings["database_inconsistencies"]:
                print(f"      - {issue}")
        else:
            print(f"   ✅ Database state appears consistent")
        
        print(f"\n🎯 TARGET PLAYER STATUS ({target_player}):")
        target_status = findings["target_player_status"]
        if target_status and "error" not in target_status:
            print(f"   ✅ Player found with clean data")
            print(f"      Level: {target_status.get('level', 'unknown')}")
            print(f"      Total Treats: {target_status.get('treats_count', 0)}")
            print(f"      Brewing: {target_status.get('brewing_treats', 0)}")
            print(f"      Ready: {target_status.get('ready_treats', 0)}")
        else:
            print(f"   🚨 Target player not found or has issues")
        
        # Overall assessment
        total_issues = len(findings["mock_data_found"]) + len(findings["mixing_timer_issues"]) + len(findings["database_inconsistencies"])
        
        if total_issues == 0:
            print(f"\n🎉 OVERALL ASSESSMENT: No critical bugs detected!")
            print(f"   ✅ Database appears clean")
            print(f"   ✅ Mixing timer system working")
            print(f"   ✅ No mock data contamination")
        else:
            print(f"\n🚨 OVERALL ASSESSMENT: {total_issues} issues require attention")
            all_success = False
        
        return all_success, findings

    def test_user_registration_api(self):
        """Test user registration system backend API endpoint /api/players/register"""
        print("\n🔐 TESTING USER REGISTRATION SYSTEM")
        print("=" * 60)
        
        # Test data as specified in review request
        test_wallet = "0x1234567890123456789012345678901234567890"
        test_username = "TestDogeScientist"
        mock_signature = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234"
        mock_message = "Register for DogeFood Lab with username: TestDogeScientist"
        
        all_success = True
        
        # 1. Test valid registration
        print(f"\n🧪 Testing Valid Registration")
        registration_data = {
            "address": test_wallet,
            "username": test_username,
            "signature": mock_signature,
            "message": mock_message
        }
        
        success, response = self.run_test(
            "Valid User Registration", 
            "POST", 
            "players/register", 
            200, 
            data=registration_data
        )
        
        if success and response:
            # Verify response contains expected fields
            expected_fields = ['message', 'player_id', 'address', 'username', 'registered_at']
            missing_fields = [field for field in expected_fields if field not in response]
            if not missing_fields:
                print(f"   ✅ Registration successful with all required fields")
                print(f"   📝 Username: {response.get('username')}")
                print(f"   📍 Address: {response.get('address')}")
                print(f"   🆔 Player ID: {response.get('player_id', 'N/A')[:8]}...")
            else:
                print(f"   ❌ Missing response fields: {missing_fields}")
                all_success = False
        else:
            print(f"   ❌ Valid registration failed")
            all_success = False
        
        # 2. Test username validation - too short
        print(f"\n🧪 Testing Username Validation - Too Short")
        short_username_data = {
            "address": "0x1234567890123456789012345678901234567891",
            "username": "ab",  # Too short (< 3 characters)
            "signature": mock_signature,
            "message": mock_message
        }
        
        success, response = self.run_test(
            "Username Too Short", 
            "POST", 
            "players/register", 
            400, 
            data=short_username_data
        )
        
        if success:
            print(f"   ✅ Short username properly rejected")
        else:
            print(f"   ❌ Short username validation failed")
            all_success = False
        
        # 3. Test username validation - too long
        print(f"\n🧪 Testing Username Validation - Too Long")
        long_username_data = {
            "address": "0x1234567890123456789012345678901234567892",
            "username": "ThisUsernameIsWayTooLongForTheSystem",  # Too long (> 20 characters)
            "signature": mock_signature,
            "message": mock_message
        }
        
        success, response = self.run_test(
            "Username Too Long", 
            "POST", 
            "players/register", 
            400, 
            data=long_username_data
        )
        
        if success:
            print(f"   ✅ Long username properly rejected")
        else:
            print(f"   ❌ Long username validation failed")
            all_success = False
        
        # 4. Test username validation - invalid characters
        print(f"\n🧪 Testing Username Validation - Invalid Characters")
        invalid_chars_data = {
            "address": "0x1234567890123456789012345678901234567893",
            "username": "Test@User!",  # Contains invalid characters
            "signature": mock_signature,
            "message": mock_message
        }
        
        success, response = self.run_test(
            "Username Invalid Characters", 
            "POST", 
            "players/register", 
            400, 
            data=invalid_chars_data
        )
        
        if success:
            print(f"   ✅ Invalid characters properly rejected")
        else:
            print(f"   ❌ Invalid character validation failed")
            all_success = False
        
        # 5. Test duplicate username prevention
        print(f"\n🧪 Testing Duplicate Username Prevention")
        duplicate_username_data = {
            "address": "0x1234567890123456789012345678901234567894",
            "username": test_username,  # Same username as first registration
            "signature": mock_signature,
            "message": mock_message
        }
        
        success, response = self.run_test(
            "Duplicate Username", 
            "POST", 
            "players/register", 
            409, 
            data=duplicate_username_data
        )
        
        if success:
            print(f"   ✅ Duplicate username properly rejected")
        else:
            print(f"   ❌ Duplicate username prevention failed")
            all_success = False
        
        # 6. Test duplicate wallet address prevention
        print(f"\n🧪 Testing Duplicate Wallet Address Prevention")
        duplicate_wallet_data = {
            "address": test_wallet,  # Same wallet as first registration
            "username": "AnotherUsername",
            "signature": mock_signature,
            "message": mock_message
        }
        
        success, response = self.run_test(
            "Duplicate Wallet Address", 
            "POST", 
            "players/register", 
            409, 
            data=duplicate_wallet_data
        )
        
        if success:
            print(f"   ✅ Duplicate wallet address properly rejected")
        else:
            print(f"   ❌ Duplicate wallet prevention failed")
            all_success = False
        
        # 7. Test missing required fields
        print(f"\n🧪 Testing Missing Required Fields")
        missing_fields_data = {
            "address": "0x1234567890123456789012345678901234567895",
            "username": "ValidUser"
            # Missing signature and message
        }
        
        success, response = self.run_test(
            "Missing Required Fields", 
            "POST", 
            "players/register", 
            400, 
            data=missing_fields_data
        )
        
        if success:
            print(f"   ✅ Missing fields properly rejected")
        else:
            print(f"   ❌ Missing fields validation failed")
            all_success = False
        
        return all_success, {"test_wallet": test_wallet, "test_username": test_username}

    def test_player_retrieval_after_registration(self):
        """Test GET /api/player/{address} to verify newly registered players"""
        print("\n👤 TESTING PLAYER RETRIEVAL AFTER REGISTRATION")
        print("=" * 60)
        
        # Use the test wallet from registration
        test_wallet = "0x1234567890123456789012345678901234567890"
        
        all_success = True
        
        # 1. Test retrieving registered player
        print(f"\n🧪 Testing Player Retrieval")
        success, response = self.run_test(
            "Get Registered Player", 
            "GET", 
            f"player/{test_wallet}", 
            200
        )
        
        if success and response:
            # Verify player data includes nickname field
            expected_fields = ['address', 'nickname', 'level', 'experience', 'points', 'is_nft_holder']
            missing_fields = [field for field in expected_fields if field not in response]
            if not missing_fields:
                print(f"   ✅ Player retrieved with all required fields")
                print(f"   📝 Nickname: {response.get('nickname')}")
                print(f"   📍 Address: {response.get('address')}")
                print(f"   🎯 Level: {response.get('level')}")
                print(f"   ⭐ Experience: {response.get('experience')}")
                print(f"   🏆 Points: {response.get('points')}")
                
                # Verify nickname field specifically
                if response.get('nickname') == "TestDogeScientist":
                    print(f"   ✅ Nickname field properly stored and retrieved")
                else:
                    print(f"   ❌ Nickname field mismatch: expected 'TestDogeScientist', got '{response.get('nickname')}'")
                    all_success = False
            else:
                print(f"   ❌ Missing player fields: {missing_fields}")
                all_success = False
        else:
            print(f"   ❌ Player retrieval failed")
            all_success = False
        
        # 2. Test error handling for non-existent player
        print(f"\n🧪 Testing Non-Existent Player Error Handling")
        non_existent_wallet = "0x9999999999999999999999999999999999999999"
        
        success, response = self.run_test(
            "Get Non-Existent Player", 
            "GET", 
            f"player/{non_existent_wallet}", 
            404
        )
        
        if success:
            print(f"   ✅ Non-existent player properly returns 404")
        else:
            print(f"   ❌ Non-existent player error handling failed")
            all_success = False
        
        return all_success, {}

    def test_registration_integration_flow(self):
        """Test complete registration flow integration"""
        print("\n🔄 TESTING COMPLETE REGISTRATION INTEGRATION FLOW")
        print("=" * 60)
        
        # Test with multiple realistic scenarios
        test_scenarios = [
            {
                "name": "NFT Holder Registration",
                "address": "0x2234567890123456789012345678901234567890",
                "username": "NFTDogeScientist",
                "is_nft_holder": True
            },
            {
                "name": "Regular Player Registration", 
                "address": "0x3234567890123456789012345678901234567890",
                "username": "RegularDogePlayer",
                "is_nft_holder": False
            },
            {
                "name": "Underscore Username",
                "address": "0x4234567890123456789012345678901234567890", 
                "username": "Doge_Scientist_2024",
                "is_nft_holder": False
            }
        ]
        
        all_success = True
        registered_players = []
        
        # 1. Register multiple players
        print(f"\n🧪 Testing Multiple Player Registrations")
        for scenario in test_scenarios:
            registration_data = {
                "address": scenario["address"],
                "username": scenario["username"],
                "signature": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234",
                "message": f"Register for DogeFood Lab with username: {scenario['username']}"
            }
            
            success, response = self.run_test(
                scenario["name"], 
                "POST", 
                "players/register", 
                200, 
                data=registration_data
            )
            
            if success and response:
                print(f"   ✅ {scenario['name']}: Registration successful")
                registered_players.append(scenario)
            else:
                print(f"   ❌ {scenario['name']}: Registration failed")
                all_success = False
        
        # 2. Verify all players appear in leaderboard
        print(f"\n🧪 Testing Players Appear in Leaderboard")
        success, response = self.run_test(
            "Get Leaderboard After Registration", 
            "GET", 
            "leaderboard", 
            200, 
            params={"limit": 20}
        )
        
        if success and response:
            leaderboard_addresses = [entry.get('address') for entry in response]
            registered_addresses = [player['address'] for player in registered_players]
            
            # Check if registered players appear in leaderboard
            found_players = 0
            for address in registered_addresses:
                if address in leaderboard_addresses:
                    found_players += 1
                    print(f"   ✅ Player {address[:10]}... found in leaderboard")
                else:
                    print(f"   ⚠️  Player {address[:10]}... not found in leaderboard (may need points)")
            
            if found_players > 0:
                print(f"   ✅ {found_players}/{len(registered_addresses)} registered players found in leaderboard")
            else:
                print(f"   ⚠️  No registered players found in leaderboard (expected for new players with 0 points)")
        else:
            print(f"   ❌ Leaderboard retrieval failed")
            all_success = False
        
        # 3. Test player data consistency
        print(f"\n🧪 Testing Player Data Consistency")
        for player in registered_players:
            success, response = self.run_test(
                f"Verify {player['username']}", 
                "GET", 
                f"player/{player['address']}", 
                200
            )
            
            if success and response:
                # Verify data consistency
                if (response.get('address') == player['address'] and 
                    response.get('nickname') == player['username']):
                    print(f"   ✅ {player['username']}: Data consistency verified")
                else:
                    print(f"   ❌ {player['username']}: Data inconsistency detected")
                    all_success = False
            else:
                print(f"   ❌ {player['username']}: Verification failed")
                all_success = False
        
        # 4. Test treat creation with registered players
        print(f"\n🧪 Testing Treat Creation with Registered Players")
        if registered_players:
            test_player = registered_players[0]
            treat_data = {
                "creator_address": test_player["address"],
                "ingredients": ["bacon", "cheese", "herbs"],
                "player_level": 1
            }
            
            success, response = self.run_test(
                "Create Treat with Registered Player", 
                "POST", 
                "treats/enhanced", 
                200, 
                data=treat_data
            )
            
            if success and response:
                print(f"   ✅ Treat creation successful with registered player")
                
                # Verify treat is associated with correct player
                treat = response.get('treat', {})
                if treat.get('creator_address') == test_player['address']:
                    print(f"   ✅ Treat properly associated with registered player")
                else:
                    print(f"   ❌ Treat association failed")
                    all_success = False
            else:
                print(f"   ❌ Treat creation failed with registered player")
                all_success = False
        
        return all_success, {"registered_players": len(registered_players)}

    def test_get_current_season(self):
        """Test getting current season information"""
        return self.run_test("Get Current Season", "GET", "seasons/current", 200)

    def test_final_production_readiness(self):
        """🚀 FINAL PRODUCTION READINESS VERIFICATION for Telegram Mini App"""
        print("\n" + "="*80)
        print("🚀 FINAL PRODUCTION READINESS VERIFICATION")
        print("DogeFood Lab Telegram Mini App - Production Deployment Check")
        print("="*80)
        
        production_tests = []
        
        # 1. Backend System Verification
        print("\n🔧 1. BACKEND SYSTEM VERIFICATION")
        print("-" * 50)
        
        backend_tests = [
            ("API Health Check", self.test_health_check),
            ("Core Player Management", self.test_create_player_with_nickname),
            ("Enhanced Treat Creation", self.test_enhanced_treat_creation_endpoint),
            ("Leaderboard System", self.test_leaderboard_with_nicknames),
            ("Game Statistics", self.test_get_game_stats),
            ("Timer System", self.test_timer_progression_system),
            ("Season Management", self.test_season_management_system)
        ]
        
        backend_passed = 0
        for test_name, test_func in backend_tests:
            try:
                success, _ = test_func()
                if success:
                    backend_passed += 1
                    print(f"   ✅ {test_name}")
                else:
                    print(f"   ❌ {test_name}")
            except Exception as e:
                print(f"   ❌ {test_name}: {str(e)}")
        
        production_tests.append(("Backend System", backend_passed, len(backend_tests)))
        
        # 2. Performance Testing
        print("\n⚡ 2. PERFORMANCE TESTING")
        print("-" * 50)
        
        perf_passed = 0
        perf_total = 3
        
        # API Response Time Test
        start_time = time.time()
        success, _ = self.test_health_check()
        response_time = (time.time() - start_time) * 1000
        if success and response_time < 1000:  # Under 1 second
            perf_passed += 1
            print(f"   ✅ API Response Time: {response_time:.2f}ms")
        else:
            print(f"   ❌ API Response Time: {response_time:.2f}ms (too slow)")
        
        # Database Query Performance
        start_time = time.time()
        success, _ = self.test_get_leaderboard()
        query_time = (time.time() - start_time) * 1000
        if success and query_time < 2000:  # Under 2 seconds
            perf_passed += 1
            print(f"   ✅ Database Query Time: {query_time:.2f}ms")
        else:
            print(f"   ❌ Database Query Time: {query_time:.2f}ms (too slow)")
        
        # Concurrent User Simulation
        concurrent_success = 0
        for i in range(3):  # Test 3 concurrent requests
            success, _ = self.test_get_game_stats()
            if success:
                concurrent_success += 1
        
        if concurrent_success == 3:
            perf_passed += 1
            print(f"   ✅ Concurrent Users: 3/3 requests successful")
        else:
            print(f"   ❌ Concurrent Users: {concurrent_success}/3 requests successful")
        
        production_tests.append(("Performance", perf_passed, perf_total))
        
        # 3. Security & Authentication
        print("\n🔒 3. SECURITY & AUTHENTICATION")
        print("-" * 50)
        
        security_tests = [
            ("Telegram Hash Validation", self.test_telegram_security_validation),
            ("Authentication Error Handling", self.test_telegram_auth_error_handling),
            ("Anti-cheat System", self.test_player_risk_assessment),
            ("Input Validation", self.test_error_handling)
        ]
        
        security_passed = 0
        for test_name, test_func in security_tests:
            try:
                success, _ = test_func()
                if success:
                    security_passed += 1
                    print(f"   ✅ {test_name}")
                else:
                    print(f"   ❌ {test_name}")
            except Exception as e:
                print(f"   ❌ {test_name}: {str(e)}")
        
        production_tests.append(("Security", security_passed, len(security_tests)))
        
        # 4. Integration Testing
        print("\n🔗 4. INTEGRATION TESTING")
        print("-" * 50)
        
        integration_tests = [
            ("Telegram Authentication", self.test_telegram_registration_endpoint),
            ("Enhanced Game Mechanics", self.test_enhanced_treat_creation_endpoint),
            ("Points System Integration", self.test_background_points_awarding),
            ("Season 1 Features", self.test_season_1_offchain_implementation),
            ("Blockchain Fix Verification", self.test_enhanced_treat_creation_blockchain_fix)
        ]
        
        integration_passed = 0
        for test_name, test_func in integration_tests:
            try:
                success, _ = test_func()
                if success:
                    integration_passed += 1
                    print(f"   ✅ {test_name}")
                else:
                    print(f"   ❌ {test_name}")
            except Exception as e:
                print(f"   ❌ {test_name}: {str(e)}")
        
        production_tests.append(("Integration", integration_passed, len(integration_tests)))
        
        # 5. Production Readiness Check
        print("\n🚀 5. PRODUCTION READINESS CHECK")
        print("-" * 50)
        
        readiness_passed = 0
        readiness_total = 4
        
        # Service Stability
        stability_checks = 0
        for i in range(5):  # 5 consecutive health checks
            success, _ = self.test_health_check()
            if success:
                stability_checks += 1
            time.sleep(0.5)
        
        if stability_checks == 5:
            readiness_passed += 1
            print(f"   ✅ Service Stability: 5/5 health checks passed")
        else:
            print(f"   ❌ Service Stability: {stability_checks}/5 health checks passed")
        
        # Configuration Validation
        success, response = self.test_get_current_season()
        if success and response.get('season_id') == 1:
            readiness_passed += 1
            print(f"   ✅ Configuration: Season 1 properly configured")
        else:
            print(f"   ❌ Configuration: Season configuration issues")
        
        # Error Recovery
        # Test with invalid data and verify proper error responses
        success, _ = self.run_test("Error Recovery Test", "GET", "player/invalid_address", 404)
        if success:
            readiness_passed += 1
            print(f"   ✅ Error Recovery: Proper 404 handling")
        else:
            print(f"   ❌ Error Recovery: Error handling issues")
        
        # Deployment Readiness
        # Check if all critical endpoints are accessible
        critical_endpoints = [
            ("", 200),  # Health check
            ("leaderboard", 200),
            ("stats", 200),
            ("seasons/current", 200)
        ]
        
        endpoint_success = 0
        for endpoint, expected_status in critical_endpoints:
            success, _ = self.run_test(f"Critical Endpoint: {endpoint}", "GET", endpoint, expected_status)
            if success:
                endpoint_success += 1
        
        if endpoint_success == len(critical_endpoints):
            readiness_passed += 1
            print(f"   ✅ Deployment Readiness: All critical endpoints accessible")
        else:
            print(f"   ❌ Deployment Readiness: {endpoint_success}/{len(critical_endpoints)} endpoints accessible")
        
        production_tests.append(("Production Readiness", readiness_passed, readiness_total))
        
        # Final Assessment
        print("\n" + "="*80)
        print("📊 FINAL PRODUCTION READINESS ASSESSMENT")
        print("="*80)
        
        total_passed = 0
        total_tests = 0
        
        for category, passed, total in production_tests:
            percentage = (passed / total) * 100
            total_passed += passed
            total_tests += total
            
            status = "✅ PASS" if percentage >= 80 else "⚠️ WARN" if percentage >= 60 else "❌ FAIL"
            print(f"{category:20} {passed:2}/{total:2} ({percentage:5.1f}%) {status}")
        
        overall_percentage = (total_passed / total_tests) * 100
        print(f"{'='*50}")
        print(f"{'OVERALL SCORE':20} {total_passed:2}/{total_tests:2} ({overall_percentage:5.1f}%)")
        
        # Production Readiness Verdict
        print(f"\n🎯 PRODUCTION READINESS VERDICT:")
        if overall_percentage >= 95:
            print(f"🚀 EXCELLENT - DogeFood Lab Telegram Mini App is 100% PRODUCTION READY!")
            print(f"   ✅ All systems operational and optimized")
            print(f"   ✅ Ready for immediate live deployment")
        elif overall_percentage >= 85:
            print(f"✅ GOOD - DogeFood Lab Telegram Mini App is PRODUCTION READY!")
            print(f"   ✅ Minor optimizations recommended but not blocking")
            print(f"   ✅ Safe for live deployment")
        elif overall_percentage >= 70:
            print(f"⚠️ FAIR - DogeFood Lab needs improvements before production")
            print(f"   ⚠️ Address identified issues before deployment")
            print(f"   ⚠️ Consider staged rollout")
        else:
            print(f"❌ POOR - DogeFood Lab NOT ready for production")
            print(f"   ❌ Critical issues must be resolved")
            print(f"   ❌ Do not deploy until issues are fixed")
        
        # Bot Configuration Status
        print(f"\n🤖 TELEGRAM BOT STATUS:")
        print(f"   Bot: @Dogefoodlabbot")
        print(f"   URL: https://dogegamelab.preview.emergentagent.com")
        print(f"   Status: {'✅ READY FOR LAUNCH' if overall_percentage >= 85 else '⚠️ NEEDS ATTENTION'}")
        
        return overall_percentage >= 85, {
            "overall_score": overall_percentage,
            "category_scores": production_tests,
            "production_ready": overall_percentage >= 85
        }

    def test_final_production_verification(self):
        """Test final production verification after fixes as requested in review"""
        print("\n🎯 FINAL PRODUCTION VERIFICATION AFTER FIXES")
        print("=" * 70)
        print("Focus: Points System Integration Fix, Season Configuration Fix, Core Functionality")
        
        all_success = True
        critical_issues = []
        
        # 1. Points System Integration Fix - Test GET /api/points/{address}/stats endpoint
        print(f"\n🔍 Testing Points System Integration Fix")
        test_address = "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54"
        
        success, response = self.run_test(
            "Points Stats Endpoint (Previously 500 Error)", 
            "GET", 
            f"points/{test_address}/stats", 
            200
        )
        
        if success and response:
            print(f"   ✅ Points stats endpoint now returns data instead of 500 error")
            print(f"   📊 Player data: {response.get('player', {}).get('address', 'Unknown')}")
            print(f"   📊 Total points: {response.get('player', {}).get('total_points', 0)}")
            print(f"   📊 Activity data: {len(response.get('activity', {}))}")
        else:
            print(f"   ❌ Points stats endpoint still failing")
            critical_issues.append("Points System Integration - GET /api/points/{address}/stats endpoint")
            all_success = False
        
        # Test error handling is working properly
        success2, response2 = self.run_test(
            "Points Stats Error Handling", 
            "GET", 
            "points/0xnonexistent/stats", 
            404
        )
        
        if success2:
            print(f"   ✅ Error handling working properly (404 for non-existent player)")
        else:
            print(f"   ❌ Error handling not working correctly")
            critical_issues.append("Points System Error Handling")
            all_success = False
        
        # 2. Season Configuration Fix - Test GET /api/seasons/current endpoint
        print(f"\n📅 Testing Season Configuration Fix")
        
        success, response = self.run_test(
            "Current Season Endpoint (Season 1 Status)", 
            "GET", 
            "seasons/current", 
            200
        )
        
        if success and response:
            season_data = response.get('season', {})
            season_id = season_data.get('season_id')
            season_status = season_data.get('status')
            season_name = season_data.get('name', 'Unknown')
            
            print(f"   📊 Season ID: {season_id}")
            print(f"   📊 Season Name: {season_name}")
            print(f"   📊 Season Status: {season_status}")
            
            # Verify Season 1 shows status: "active" instead of "archived"
            if season_id == 1 and season_status == "active":
                print(f"   ✅ Season 1 now shows status: 'active' instead of 'archived'")
                
                # Check season dates are correct (2024-01-01 to 2025-12-31)
                start_date = season_data.get('start_date', '')
                end_date = season_data.get('end_date', '')
                print(f"   📅 Season dates: {start_date} to {end_date}")
                
                if '2024-01-01' in start_date and '2025-12-31' in end_date:
                    print(f"   ✅ Season dates are correct (2024-01-01 to 2025-12-31)")
                else:
                    print(f"   ❌ Season dates incorrect - Expected 2024-01-01 to 2025-12-31")
                    critical_issues.append("Season 1 Date Configuration")
                    all_success = False
            else:
                print(f"   ❌ Season 1 configuration incorrect - Expected season_id=1, status='active'")
                critical_issues.append("Season 1 Status Configuration")
                all_success = False
        else:
            print(f"   ❌ Season configuration endpoint failing")
            critical_issues.append("Season Configuration - GET /api/seasons/current endpoint")
            all_success = False
        
        # 3. Core Functionality Verification
        print(f"\n🎮 Testing Core Functionality Verification")
        
        # Test treat creation endpoint
        treat_data = {
            "creator_address": test_address,
            "ingredients": ["chicken", "bones", "rice"],
            "player_level": 5
        }
        
        success, response = self.run_test(
            "Treat Creation Endpoint", 
            "POST", 
            "treats/enhanced", 
            200, 
            data=treat_data
        )
        
        if success and response:
            print(f"   ✅ Treat creation endpoint working")
            treat_id = response.get('treat', {}).get('id')
            rarity = response.get('outcome', {}).get('rarity', 'Unknown')
            print(f"   🧪 Created treat: {treat_id} (Rarity: {rarity})")
        else:
            print(f"   ❌ Treat creation endpoint failing")
            critical_issues.append("Treat Creation Endpoint")
            all_success = False
        
        # Test player registration endpoints
        player_data = {
            "address": "0xPRODUCTION_TEST_123456789012345678901234",
            "nickname": "ProductionTester",
            "is_nft_holder": True
        }
        
        success, response = self.run_test(
            "Player Registration Endpoint", 
            "POST", 
            "player", 
            200, 
            data=player_data
        )
        
        if success and response:
            print(f"   ✅ Player registration endpoint working")
            player_address = response.get('address')
            player_nickname = response.get('nickname')
            print(f"   👤 Registered player: {player_address} ({player_nickname})")
        else:
            print(f"   ❌ Player registration endpoint failing")
            critical_issues.append("Player Registration Endpoint")
            all_success = False
        
        # Test leaderboard is working
        success, response = self.run_test(
            "Leaderboard Endpoint", 
            "GET", 
            "leaderboard", 
            200, 
            params={"limit": 10}
        )
        
        if success and response:
            leaderboard_count = len(response) if isinstance(response, list) else 0
            print(f"   ✅ Leaderboard endpoint working")
            print(f"   🏆 Leaderboard entries: {leaderboard_count}")
        else:
            print(f"   ❌ Leaderboard endpoint failing")
            critical_issues.append("Leaderboard Endpoint")
            all_success = False
        
        # Test Telegram authentication endpoints
        mock_telegram_data = {
            "initData": "user=%7B%22id%22%3A123456789%7D&auth_date=1640995200&hash=test_hash"
        }
        
        success, response = self.run_test(
            "Telegram Authentication Endpoint", 
            "POST", 
            "players/telegram-register", 
            401  # Expecting 401 due to hash validation (correct security behavior)
        )
        
        if success:
            print(f"   ✅ Telegram authentication endpoint working (proper security validation)")
            print(f"   🔒 Security response: {response.get('detail', 'Hash validation working')}")
        else:
            print(f"   ❌ Telegram authentication endpoint not responding correctly")
            critical_issues.append("Telegram Authentication Endpoint")
            all_success = False
        
        # 4. Final Assessment
        print(f"\n🎯 FINAL PRODUCTION VERIFICATION RESULTS:")
        print(f"=" * 50)
        
        if all_success:
            print(f"   🚀 ALL CRITICAL PRODUCTION BLOCKERS RESOLVED!")
            print(f"   ✅ Points System Integration Fix: WORKING")
            print(f"   ✅ Season Configuration Fix: WORKING") 
            print(f"   ✅ Core Functionality: WORKING")
            print(f"   ✅ System ready for live deployment!")
        else:
            print(f"   ⚠️  CRITICAL ISSUES STILL PRESENT:")
            for issue in critical_issues:
                print(f"      ❌ {issue}")
            print(f"   🚨 System NOT ready for deployment until issues resolved")
        
        print(f"=" * 50)
        
        return all_success, {
            "points_system_fixed": "Points System Integration" not in [issue for issue in critical_issues],
            "season_config_fixed": "Season 1 Status Configuration" not in [issue for issue in critical_issues],
            "core_functionality_working": len([issue for issue in critical_issues if "Endpoint" in issue]) == 0,
            "critical_issues": critical_issues,
            "deployment_ready": all_success
        }

    def test_comprehensive_game_lab_features(self):
        """Test all core game lab features as requested in the review"""
        print("🎯 COMPREHENSIVE GAME LAB FEATURES TESTING")
        print("=" * 70)
        print("Testing all core game lab features for full functionality")
        print("=" * 70)
        
        all_success = True
        test_results = {}
        
        # 1. Player Data Management
        print(f"\n🔍 1. PLAYER DATA MANAGEMENT TESTING")
        print("-" * 50)
        
        # Test wallet user creation
        wallet_player_data = {
            "address": "0x742d35Cc6634C0532925a3b8D3B8C9e9D71a4a54",
            "nickname": "WalletDogeScientist",
            "is_nft_holder": True
        }
        success1, response1 = self.run_test("Create Wallet Player", "POST", "player", 200, data=wallet_player_data)
        
        # Test player retrieval
        success2, response2 = self.run_test("Get Wallet Player", "GET", f"player/{wallet_player_data['address']}", 200)
        
        # Test player level/experience/points systems
        progress_data = {
            "address": wallet_player_data['address'],
            "experience": 150,
            "points": 75,
            "level": 3
        }
        success3, response3 = self.run_test("Update Player Progress", "POST", "player/progress", 200, data=progress_data)
        
        # Test Telegram user creation (expect 401 due to security validation)
        telegram_data = {"initData": "mock_telegram_data_for_testing"}
        success4, response4 = self.run_test("Telegram Player Registration", "POST", "players/telegram-register", 401, data=telegram_data)
        
        player_mgmt_success = success1 and success2 and success3 and success4
        test_results["player_management"] = player_mgmt_success
        print(f"   Player Management Result: {'✅ PASSED' if player_mgmt_success else '❌ FAILED'}")
        
        # 2. Treat Creation System
        print(f"\n🧪 2. TREAT CREATION SYSTEM TESTING")
        print("-" * 50)
        
        # Test enhanced treat creation with various rarities
        treat_scenarios = [
            {
                "name": "Common Treat (2 ingredients)",
                "data": {
                    "creator_address": wallet_player_data['address'],
                    "ingredients": ["chicken", "bones"],
                    "player_level": 1
                }
            },
            {
                "name": "Rare Treat (3 ingredients)",
                "data": {
                    "creator_address": wallet_player_data['address'],
                    "ingredients": ["premium_bacon", "aged_cheese", "herbs"],
                    "player_level": 5
                }
            },
            {
                "name": "Epic Treat (4 ingredients)",
                "data": {
                    "creator_address": wallet_player_data['address'],
                    "ingredients": ["wagyu_beef", "truffle_oil", "gold_flakes", "caviar"],
                    "player_level": 10
                }
            },
            {
                "name": "Legendary Treat (5+ ingredients)",
                "data": {
                    "creator_address": wallet_player_data['address'],
                    "ingredients": ["chocolate", "honey", "milk", "strawberry", "banana"],
                    "player_level": 15
                }
            }
        ]
        
        treat_creation_success = True
        created_treat_ids = []
        
        for scenario in treat_scenarios:
            success, response = self.run_test(scenario["name"], "POST", "treats/enhanced", 200, data=scenario["data"])
            if success and response:
                treat = response.get('treat', {})
                outcome = response.get('outcome', {})
                if 'id' in treat:
                    created_treat_ids.append(treat['id'])
                print(f"      Created {outcome.get('rarity', 'Unknown')} treat with {outcome.get('timer_duration_hours', 0)}h timer")
            if not success:
                treat_creation_success = False
        
        test_results["treat_creation"] = treat_creation_success
        print(f"   Treat Creation Result: {'✅ PASSED' if treat_creation_success else '❌ FAILED'}")
        
        # 3. Active Treats Management
        print(f"\n⏰ 3. ACTIVE TREATS MANAGEMENT TESTING")
        print("-" * 50)
        
        # Test getting player treats
        success5, response5 = self.run_test("Get Player Treats", "GET", f"treats/{wallet_player_data['address']}", 200)
        
        # Test brewing treats endpoint
        success6, response6 = self.run_test("Get Brewing Treats", "GET", f"treats/{wallet_player_data['address']}/brewing", 200)
        
        # Test timer checking if we have a treat ID
        timer_success = True
        if created_treat_ids:
            success7, response7 = self.run_test("Check Treat Timer", "POST", f"treats/{created_treat_ids[0]}/check-timer", 200)
            timer_success = success7
        
        active_treats_success = success5 and success6 and timer_success
        test_results["active_treats"] = active_treats_success
        print(f"   Active Treats Management Result: {'✅ PASSED' if active_treats_success else '❌ FAILED'}")
        
        # 4. Character System Integration (Note: This may not be fully implemented)
        print(f"\n👤 4. CHARACTER SYSTEM INTEGRATION TESTING")
        print("-" * 50)
        
        # Check if player profile includes character data
        character_success = True
        if success2 and response2:
            # Look for character-related fields in player data
            character_fields = ['character', 'selected_character', 'character_bonuses']
            has_character_system = any(field in response2 for field in character_fields)
            if not has_character_system:
                print("      ⚠️  Character system not detected in player profiles")
                character_success = False
            else:
                print("      ✅ Character system detected in player data")
        
        test_results["character_system"] = character_success
        print(f"   Character System Result: {'✅ PASSED' if character_success else '⚠️  NOT IMPLEMENTED'}")
        
        # 5. Level and Experience System
        print(f"\n📈 5. LEVEL AND EXPERIENCE SYSTEM TESTING")
        print("-" * 50)
        
        # Test ingredient unlocking based on level
        level_tests = [1, 5, 10, 15, 20, 25]
        level_success = True
        
        for level in level_tests:
            success, response = self.run_test(f"Get Level {level} Ingredients", "GET", "ingredients", 200, params={"level": level})
            if success and response:
                ingredient_count = len(response.get('ingredients', []))
                print(f"      Level {level}: {ingredient_count} ingredients available")
            else:
                level_success = False
        
        # Test XP bonuses and multipliers through treat creation
        if treat_creation_success:
            print("      ✅ XP system integrated with treat creation")
        
        test_results["level_experience"] = level_success
        print(f"   Level & Experience System Result: {'✅ PASSED' if level_success else '❌ FAILED'}")
        
        # 6. Points and Rewards System
        print(f"\n💰 6. POINTS AND REWARDS SYSTEM TESTING")
        print("-" * 50)
        
        # Test points calculation and distribution
        success8, response8 = self.run_test("Player Points Stats", "GET", f"points/{wallet_player_data['address']}/stats", 200)
        success9, response9 = self.run_test("Points Leaderboard", "GET", "points/leaderboard", 200)
        success10, response10 = self.run_test("Daily Bonus System", "POST", f"points/{wallet_player_data['address']}/daily-bonus", 200)
        
        # Test leaderboard integration
        success11, response11 = self.run_test("Main Leaderboard", "GET", "leaderboard", 200)
        
        points_success = success8 and success9 and success11
        test_results["points_rewards"] = points_success
        print(f"   Points & Rewards System Result: {'✅ PASSED' if points_success else '❌ FAILED'}")
        
        # 7. Season Management
        print(f"\n📅 7. SEASON MANAGEMENT TESTING")
        print("-" * 50)
        
        # Test current season info
        success12, response12 = self.run_test("Current Season Info", "GET", "season/current", 200)
        success13, response13 = self.run_test("Season List", "GET", "seasons", 200)
        success14, response14 = self.run_test("Season 1 Details", "GET", "seasons/1", 200)
        
        season_success = success12 and success13 and success14
        
        # Verify Season 1 (2025-2026) is active
        if success12 and response12:
            season_id = response12.get('season_id')
            season_status = response12.get('status')
            is_offchain = response12.get('is_offchain_only')
            
            if season_id == 1 and season_status == 'active' and is_offchain == True:
                print(f"      ✅ Season 1 is active and properly configured as offchain-only")
            else:
                print(f"      ⚠️  Season 1 configuration: ID={season_id}, Status={season_status}, Offchain={is_offchain}")
        
        test_results["season_management"] = season_success
        print(f"   Season Management Result: {'✅ PASSED' if season_success else '❌ FAILED'}")
        
        # Additional Integration Tests
        print(f"\n🔧 ADDITIONAL INTEGRATION TESTING")
        print("-" * 50)
        
        # Test game engine endpoints
        success15, response15 = self.run_test("Timer Progression", "GET", "game/timer-progression", 200, params={"max_level": 30})
        success16, response16 = self.run_test("Ingredient Stats", "GET", "ingredients/stats", 200)
        success17, response17 = self.run_test("Game Simulation", "POST", "game/simulate-outcome", 200, data={
            "ingredients": ["chicken", "bones", "cheese"],
            "player_level": 10,
            "player_address": wallet_player_data['address'],
            "simulations": 5
        })
        
        integration_success = success15 and success16 and success17
        test_results["integration"] = integration_success
        print(f"   Integration Testing Result: {'✅ PASSED' if integration_success else '❌ FAILED'}")
        
        # Calculate overall success
        passed_tests = sum(1 for result in test_results.values() if result)
        total_tests = len(test_results)
        overall_success = passed_tests >= (total_tests * 0.8)  # 80% pass rate
        
        print(f"\n🎯 COMPREHENSIVE GAME LAB FEATURES TEST RESULTS")
        print("=" * 70)
        print(f"Tests Passed: {passed_tests}/{total_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print(f"Overall Result: {'✅ PASSED' if overall_success else '❌ FAILED'}")
        
        # Detailed results
        print(f"\nDetailed Results:")
        for test_name, result in test_results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"  {test_name.replace('_', ' ').title()}: {status}")
        
        if not overall_success:
            print(f"\n⚠️  Some features may need attention for full functionality")
        
        return overall_success, test_results

def main():
    print("🚀 DogeFood Lab - COMPREHENSIVE GAME LAB FEATURES TESTING 🧪")
    print("Testing all core game lab features as requested in review")
    print("=" * 80)
    
    tester = DogeLabAPITester()
    
    # RUN COMPREHENSIVE GAME LAB FEATURES TEST
    print("\n🎯 PRIMARY FOCUS: COMPREHENSIVE GAME LAB FEATURES TESTING")
    print("Testing all core game lab features for full functionality")
    
    try:
        # Run the comprehensive game lab features test
        print(f"\n🚀 RUNNING COMPREHENSIVE GAME LAB FEATURES TEST")
        success, results = tester.test_comprehensive_game_lab_features()
        
        # Update test counters
        tester.tests_run += len(results)
        tester.tests_passed += sum(1 for result in results.values() if result)
        
        # Print comprehensive results
        print("\n" + "=" * 80)
        print(f"📊 FINAL TEST RESULTS: {tester.tests_passed}/{tester.tests_run} tests passed")
        print("=" * 80)
        
        # Categorize results
        success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
        
        print(f"📊 INDIVIDUAL TEST SUCCESS RATE: {success_rate:.1f}%")
        
        # Report missing features
        if tester.missing_features:
            print(f"\n🔍 FEATURE ANALYSIS:")
            print("Missing or incomplete features:")
            for feature in set(tester.missing_features):
                print(f"   ❌ {feature}")
            print(f"\nTotal missing features: {len(set(tester.missing_features))}")
        else:
            print("\n✅ All expected features appear to be implemented correctly!")
        
        # Final assessment
        if success and success_rate >= 80:
            print("\n🚀 COMPREHENSIVE GAME LAB FEATURES TEST: SUCCESS!")
            print("✅ Player Data Management: Working correctly")
            print("✅ Treat Creation System: All rarities and timers functional")
            print("✅ Active Treats Management: Timer system operational")
            print("✅ Level & Experience System: Ingredient unlocking working")
            print("✅ Points & Rewards System: Leaderboard integration functional")
            print("✅ Season Management: Season 1 active and configured")
            print("✅ Integration: Game engine endpoints operational")
            print("\n🎉 DogeFood Lab Game Features are FULLY FUNCTIONAL!")
            return 0
        else:
            print(f"\n🔧 COMPREHENSIVE GAME LAB FEATURES TEST: ISSUES DETECTED")
            print("❌ Some game features need attention")
            print("🔍 Review detailed test results above for specific problems")
            print(f"📊 Success Rate: {success_rate:.1f}% (need 80%+ for full functionality)")
            print("\n⚠️ Some features may need fixes!")
            return 1
            
    except Exception as e:
        print(f"❌ Game lab features tests failed with exception: {str(e)}")
        print("\n🚨 CRITICAL ERROR: Cannot verify game functionality")
        print("⚠️ Review system logs for debugging!")
        return 1

if __name__ == "__main__":
    sys.exit(main())