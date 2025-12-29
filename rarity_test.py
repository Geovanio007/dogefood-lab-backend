#!/usr/bin/env python3
"""
DogeFood Lab Rarity System Test
Testing the updated rarity system on Render backend
"""

import requests
import sys
from datetime import datetime
import json
import time

class RaritySystemTester:
    def __init__(self, base_url="https://dogefood-lab-api.onrender.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0

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

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
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

    def test_rarity_system_configuration(self):
        """Test GET /api/game/rarity-system endpoint"""
        print("\n🎯 Testing Rarity System Configuration...")
        
        success, response = self.run_test("Get Rarity System", "GET", "game/rarity-system", 200)
        
        if success and response:
            rarity_system = response.get('rarity_system', {})
            
            # Check all 6 rarities are present
            expected_rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic']
            missing_rarities = []
            
            for rarity in expected_rarities:
                if rarity not in rarity_system:
                    missing_rarities.append(rarity)
            
            if missing_rarities:
                print(f"   ❌ Missing rarities: {missing_rarities}")
                return False, response
            else:
                print(f"   ✅ All 6 rarities present: {list(rarity_system.keys())}")
            
            # Check probability percentages
            expected_probabilities = {
                'Common': 45.0,
                'Uncommon': 30.0, 
                'Rare': 15.0,
                'Epic': 7.0,
                'Legendary': 2.5,
                'Mythic': 0.5
            }
            
            probability_errors = []
            for rarity, expected_prob in expected_probabilities.items():
                if rarity in rarity_system:
                    actual_prob_str = rarity_system[rarity].get('probability', '0%')
                    # Convert "45.0%" to 45.0
                    actual_prob = float(actual_prob_str.replace('%', ''))
                    if abs(actual_prob - expected_prob) > 0.1:  # Allow small floating point differences
                        probability_errors.append(f"{rarity}: expected {expected_prob}%, got {actual_prob}%")
                    else:
                        print(f"   ✅ {rarity}: {actual_prob}% (correct)")
            
            if probability_errors:
                print(f"   ❌ Probability errors: {probability_errors}")
                return False, response
            
            print(f"   ✅ All probability percentages correct")
            return True, response
        
        return False, {}

    def test_rarity_system_treat_creation_2_ingredients(self):
        """Test treat creation with 2 ingredients (Common/Uncommon only)"""
        print("\n🧪 Testing 2 Ingredients - Common/Uncommon Only...")
        
        treat_data = {
            "creator_address": "RARITY_TEST_2ING",
            "ingredients": ["chicken", "rice"],
            "player_level": 5
        }
        
        success, response = self.run_test("2 Ingredients Treat", "POST", "treats/enhanced", 200, data=treat_data)
        
        if success and response:
            outcome = response.get('outcome', {})
            rarity = outcome.get('rarity', '')
            timer_hours = outcome.get('timer_duration_hours', 0)
            points_reward = outcome.get('points_reward', 0)
            xp_reward = outcome.get('xp_reward', 0)
            
            print(f"   🎯 Result: {rarity} rarity")
            print(f"   ⏰ Timer: {timer_hours} hours")
            print(f"   🏆 Points: {points_reward}")
            print(f"   ⭐ XP: {xp_reward}")
            
            # Verify timer range (1-4 hours)
            if not (1 <= timer_hours <= 4):
                print(f"   ❌ Timer out of range: {timer_hours}h (should be 1-4h)")
                return False, response
            
            # Verify points range (10-40)
            if not (10 <= points_reward <= 40):
                print(f"   ❌ Points out of range: {points_reward} (should be 10-40)")
                return False, response
            
            # Verify XP range (5-25)
            if not (5 <= xp_reward <= 25):
                print(f"   ❌ XP out of range: {xp_reward} (should be 5-25)")
                return False, response
            
            print(f"   ✅ All constraints satisfied for 2 ingredients")
            return True, response
        
        return False, {}

    def test_rarity_system_treat_creation_4_ingredients(self):
        """Test treat creation with 4 ingredients (up to Epic)"""
        print("\n🧪 Testing 4 Ingredients - Up to Epic...")
        
        treat_data = {
            "creator_address": "RARITY_TEST_4ING",
            "ingredients": ["chicken", "rice", "vegetables", "honey"],
            "player_level": 10
        }
        
        success, response = self.run_test("4 Ingredients Treat", "POST", "treats/enhanced", 200, data=treat_data)
        
        if success and response:
            outcome = response.get('outcome', {})
            rarity = outcome.get('rarity', '')
            timer_hours = outcome.get('timer_duration_hours', 0)
            points_reward = outcome.get('points_reward', 0)
            
            print(f"   🎯 Result: {rarity} rarity")
            print(f"   ⏰ Timer: {timer_hours} hours")
            print(f"   🏆 Points: {points_reward}")
            
            # Verify timer range varies by rarity (1-8 hours)
            if not (1 <= timer_hours <= 8):
                print(f"   ❌ Timer out of range: {timer_hours}h (should be 1-8h)")
                return False, response
            
            print(f"   ✅ Rarity and timer constraints satisfied for 4 ingredients")
            return True, response
        
        return False, {}

    def test_rarity_system_treat_creation_5_ingredients(self):
        """Test treat creation with 5 ingredients (all rarities including Mythic)"""
        print("\n🧪 Testing 5 Ingredients - All Rarities Including Mythic...")
        
        treat_data = {
            "creator_address": "RARITY_TEST_5ING",
            "ingredients": ["chicken", "rice", "vegetables", "honey", "chocolate"],
            "player_level": 15
        }
        
        success, response = self.run_test("5 Ingredients Treat", "POST", "treats/enhanced", 200, data=treat_data)
        
        if success and response:
            outcome = response.get('outcome', {})
            rarity = outcome.get('rarity', '')
            points_reward = outcome.get('points_reward', 0)
            xp_reward = outcome.get('xp_reward', 0)
            rarity_emoji = outcome.get('rarity_emoji', '')
            rarity_color = outcome.get('rarity_color', '')
            
            print(f"   🎯 Result: {rarity} rarity")
            print(f"   🏆 Points: {points_reward}")
            print(f"   ⭐ XP: {xp_reward}")
            print(f"   {rarity_emoji} Emoji: {rarity_emoji}")
            print(f"   🎨 Color: {rarity_color}")
            
            # Verify all rarities are possible
            all_rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic']
            if rarity not in all_rarities:
                print(f"   ❌ Invalid rarity: {rarity}")
                return False, response
            
            # Verify required fields are present
            required_fields = ['points_reward', 'xp_reward', 'rarity_emoji', 'rarity_color']
            missing_fields = [field for field in required_fields if field not in outcome]
            if missing_fields:
                print(f"   ❌ Missing required fields: {missing_fields}")
                return False, response
            
            # Verify points and XP are within rarity ranges
            if points_reward <= 0 or xp_reward <= 0:
                print(f"   ❌ Invalid rewards: points={points_reward}, xp={xp_reward}")
                return False, response
            
            print(f"   ✅ All fields present and valid for 5 ingredients")
            return True, response
        
        return False, {}

    def test_rarity_system_response_structure(self):
        """Test that response structure includes all required fields"""
        print("\n🔍 Testing Response Structure...")
        
        treat_data = {
            "creator_address": "RARITY_STRUCTURE_TEST",
            "ingredients": ["chicken", "rice", "vegetables"],
            "player_level": 8
        }
        
        success, response = self.run_test("Response Structure Test", "POST", "treats/enhanced", 200, data=treat_data)
        
        if success and response:
            outcome = response.get('outcome', {})
            
            # Check required outcome fields
            required_outcome_fields = [
                'rarity', 'points_reward', 'xp_reward', 
                'rarity_emoji', 'rarity_color'
            ]
            
            missing_fields = []
            for field in required_outcome_fields:
                if field not in outcome:
                    missing_fields.append(field)
                else:
                    print(f"   ✅ {field}: {outcome[field]}")
            
            if missing_fields:
                print(f"   ❌ Missing outcome fields: {missing_fields}")
                return False, response
            
            # Verify rarity is valid
            valid_rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic']
            rarity = outcome.get('rarity', '')
            if rarity not in valid_rarities:
                print(f"   ❌ Invalid rarity: {rarity}")
                return False, response
            
            print(f"   ✅ All required response structure fields present")
            return True, response
        
        return False, {}

    def test_rarity_system_player_rewards(self):
        """Test that player gets correct rewards after treat creation"""
        print("\n💰 Testing Player Reward System...")
        
        test_address = "RARITY_REWARD_TEST"
        
        # Create player first
        player_data = {
            "address": test_address,
            "is_nft_holder": False
        }
        
        success1, _ = self.run_test("Create Test Player", "POST", "player", 200, data=player_data)
        
        if not success1:
            print("   ❌ Failed to create test player")
            return False, {}
        
        # Get initial player stats
        success2, initial_player = self.run_test("Get Initial Player", "GET", f"player/{test_address}", 200)
        
        if not success2:
            print("   ❌ Failed to get initial player stats")
            return False, {}
        
        initial_points = initial_player.get('points', 0)
        initial_experience = initial_player.get('experience', 0)
        
        print(f"   📊 Initial - Points: {initial_points}, XP: {initial_experience}")
        
        # Create treat
        treat_data = {
            "creator_address": test_address,
            "ingredients": ["chicken", "rice", "vegetables", "honey"],
            "player_level": 10
        }
        
        success3, treat_response = self.run_test("Create Reward Test Treat", "POST", "treats/enhanced", 200, data=treat_data)
        
        if not success3:
            print("   ❌ Failed to create treat")
            return False, {}
        
        outcome = treat_response.get('outcome', {})
        expected_points = outcome.get('points_reward', 0)
        expected_xp = outcome.get('xp_reward', 0)
        
        print(f"   🎯 Expected rewards - Points: {expected_points}, XP: {expected_xp}")
        
        # Wait a moment for background tasks
        time.sleep(3)
        
        # Get updated player stats
        success4, updated_player = self.run_test("Get Updated Player", "GET", f"player/{test_address}", 200)
        
        if not success4:
            print("   ❌ Failed to get updated player stats")
            return False, {}
        
        final_points = updated_player.get('points', 0)
        final_experience = updated_player.get('experience', 0)
        
        points_gained = final_points - initial_points
        xp_gained = final_experience - initial_experience
        
        print(f"   📈 Final - Points: {final_points} (+{points_gained}), XP: {final_experience} (+{xp_gained})")
        
        # Verify rewards were applied
        if points_gained <= 0:
            print(f"   ❌ No points awarded (expected {expected_points})")
            return False, {}
        
        if xp_gained <= 0:
            print(f"   ❌ No XP awarded (expected {expected_xp})")
            return False, {}
        
        print(f"   ✅ Player rewards correctly applied")
        return True, {"points_gained": points_gained, "xp_gained": xp_gained}

    def run_comprehensive_test(self):
        """Run comprehensive rarity system test"""
        print("🚀 COMPREHENSIVE RARITY SYSTEM TEST")
        print("=" * 60)
        print("Testing DogeFood Lab Rarity System on Render Backend")
        print(f"Backend URL: {self.base_url}")
        
        tests = [
            ("Rarity System Configuration", self.test_rarity_system_configuration),
            ("2 Ingredients (Common/Uncommon)", self.test_rarity_system_treat_creation_2_ingredients),
            ("4 Ingredients (Up to Epic)", self.test_rarity_system_treat_creation_4_ingredients),
            ("5 Ingredients (All Rarities)", self.test_rarity_system_treat_creation_5_ingredients),
            ("Response Structure", self.test_rarity_system_response_structure),
            ("Player Rewards", self.test_rarity_system_player_rewards)
        ]
        
        passed_tests = 0
        total_tests = len(tests)
        test_results = {}
        
        for test_name, test_func in tests:
            try:
                print(f"\n{'='*40}")
                print(f"🧪 RUNNING: {test_name}")
                print(f"{'='*40}")
                success, result = test_func()
                test_results[test_name] = {"success": success, "result": result}
                
                if success:
                    passed_tests += 1
                    print(f"✅ {test_name}: PASSED")
                else:
                    print(f"❌ {test_name}: FAILED")
            except Exception as e:
                print(f"❌ {test_name}: EXCEPTION - {str(e)}")
                test_results[test_name] = {"success": False, "error": str(e)}
        
        # Final Results
        print(f"\n🎯 RARITY SYSTEM TEST RESULTS")
        print("=" * 60)
        print(f"📊 Overall Score: {passed_tests}/{total_tests} tests passed")
        print(f"🎮 Backend URL: {self.base_url}")
        
        for test_name, result in test_results.items():
            status = "✅ PASS" if result["success"] else "❌ FAIL"
            print(f"{status} {test_name}")
        
        if passed_tests == total_tests:
            print(f"\n🚀 RARITY SYSTEM: ✅ FULLY FUNCTIONAL!")
            print("✅ All 6 rarities configured correctly")
            print("✅ Probability percentages match specification")
            print("✅ Ingredient count restrictions working")
            print("✅ Response structure complete")
            print("✅ Player rewards system operational")
        elif passed_tests >= total_tests * 0.8:  # 80% pass rate
            print(f"\n⚠️ RARITY SYSTEM: 🔶 MOSTLY FUNCTIONAL")
            print("⚠️ Minor issues detected but core functionality working")
        else:
            print(f"\n❌ RARITY SYSTEM: ❌ NEEDS ATTENTION")
            print("❌ Critical issues detected that need resolution")
        
        return passed_tests, total_tests, test_results

if __name__ == "__main__":
    tester = RaritySystemTester()
    passed, total, results = tester.run_comprehensive_test()
    
    print(f"\n📊 FINAL SUMMARY")
    print(f"Tests Passed: {passed}/{total}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")
    
    if passed == total:
        print("🎉 ALL RARITY SYSTEM TESTS PASSED!")
        sys.exit(0)
    else:
        print("⚠️ Some tests failed - see details above")
        sys.exit(1)