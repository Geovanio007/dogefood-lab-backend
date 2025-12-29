import requests
import time
import json
from datetime import datetime

class Phase1TimerTester:
    def __init__(self, base_url="https://dogelab-game.preview.emergentagent.com"):
        self.base_url = base_url
        self.test_player_address = "0xPhase1TestPlayer123456789012345678901234"
        self.test_treat_id = None
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def test_enhanced_player_registration(self):
        """Test Phase 1: Enhanced Player Registration with Nickname"""
        self.log("🧪 Testing Enhanced Player Registration with Nickname...")
        
        player_data = {
            "address": self.test_player_address,
            "nickname": "Phase1DogeScientist",
            "is_nft_holder": True
        }
        
        response = requests.post(f"{self.base_url}/api/player", json=player_data)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('nickname') == "Phase1DogeScientist":
                self.log("✅ Enhanced Player Registration: WORKING - Nickname field supported")
                return True
            else:
                self.log("❌ Enhanced Player Registration: FAILED - Nickname not stored properly")
                return False
        else:
            self.log(f"❌ Enhanced Player Registration: FAILED - Status {response.status_code}")
            return False
    
    def test_enhanced_treat_creation(self):
        """Test Phase 1: Enhanced Treat Creation with Timer Support"""
        self.log("🧪 Testing Enhanced Treat Creation with Timer Support...")
        
        treat_data = {
            "name": "Phase1 Timer Test Treat",
            "creator_address": self.test_player_address,
            "ingredients": ["premium_bacon", "aged_cheese", "organic_herbs"],
            "main_ingredient": "premium_bacon",
            "rarity": "legendary", 
            "flavor": "savory",
            "image": "phase1-test-treat.jpg",
            "timer_duration": 10,  # 10 seconds for quick testing
            "brewing_status": "brewing"
        }
        
        response = requests.post(f"{self.base_url}/api/treats", json=treat_data)
        
        if response.status_code == 200:
            data = response.json()
            self.test_treat_id = data.get('id')
            
            # Check all enhanced fields
            checks = [
                ('main_ingredient', data.get('main_ingredient') == "premium_bacon"),
                ('timer_duration', data.get('timer_duration') == 10),
                ('brewing_status', data.get('brewing_status') == "brewing"),
                ('ready_at', data.get('ready_at') is not None)
            ]
            
            all_passed = all(check[1] for check in checks)
            
            if all_passed:
                self.log("✅ Enhanced Treat Creation: WORKING - All timer fields supported")
                self.log(f"   Treat ID: {self.test_treat_id}")
                self.log(f"   Ready at: {data.get('ready_at')}")
                return True
            else:
                failed_checks = [check[0] for check in checks if not check[1]]
                self.log(f"❌ Enhanced Treat Creation: FAILED - Missing fields: {failed_checks}")
                return False
        else:
            self.log(f"❌ Enhanced Treat Creation: FAILED - Status {response.status_code}")
            return False
    
    def test_timer_system_endpoints(self):
        """Test Phase 1: Timer System Endpoints"""
        if not self.test_treat_id:
            self.log("❌ Timer System: FAILED - No treat ID available")
            return False
            
        self.log("🧪 Testing Timer System Endpoints...")
        
        # Test 1: Check timer immediately (should be brewing)
        response = requests.post(f"{self.base_url}/api/treats/{self.test_treat_id}/check-timer")
        
        if response.status_code != 200:
            self.log(f"❌ Timer Check Endpoint: FAILED - Status {response.status_code}")
            return False
            
        data = response.json()
        if data.get('status') != 'brewing':
            self.log(f"❌ Timer Check: FAILED - Expected 'brewing', got '{data.get('status')}'")
            return False
            
        remaining = data.get('remaining_seconds', 0)
        self.log(f"✅ Timer Check Endpoint: WORKING - {remaining} seconds remaining")
        
        # Test 2: Get brewing treats
        response = requests.get(f"{self.base_url}/api/treats/{self.test_player_address}/brewing")
        
        if response.status_code != 200:
            self.log(f"❌ Brewing Treats Endpoint: FAILED - Status {response.status_code}")
            return False
            
        brewing_treats = response.json()
        if not any(treat.get('id') == self.test_treat_id for treat in brewing_treats):
            self.log("❌ Brewing Treats: FAILED - Test treat not found in brewing list")
            return False
            
        self.log(f"✅ Brewing Treats Endpoint: WORKING - Found {len(brewing_treats)} brewing treats")
        
        # Test 3: Wait for timer completion and verify auto-update
        self.log("⏳ Waiting for timer completion (10 seconds)...")
        time.sleep(12)  # Wait a bit longer to ensure completion
        
        # Check timer again (should be ready now)
        response = requests.post(f"{self.base_url}/api/treats/{self.test_treat_id}/check-timer")
        
        if response.status_code != 200:
            self.log(f"❌ Timer Completion Check: FAILED - Status {response.status_code}")
            return False
            
        data = response.json()
        if data.get('status') != 'ready':
            self.log(f"❌ Timer Completion: FAILED - Expected 'ready', got '{data.get('status')}'")
            return False
            
        self.log("✅ Timer Auto-Update: WORKING - Status changed to 'ready' after completion")
        
        # Test 4: Verify brewing treats list is updated
        response = requests.get(f"{self.base_url}/api/treats/{self.test_player_address}/brewing")
        brewing_treats_after = response.json()
        
        if any(treat.get('id') == self.test_treat_id and treat.get('brewing_status') == 'brewing' for treat in brewing_treats_after):
            self.log("❌ Brewing List Update: FAILED - Completed treat still showing as brewing")
            return False
            
        self.log("✅ Brewing List Auto-Update: WORKING - Completed treat removed from brewing list")
        
        return True
    
    def test_3_hour_timer_creation(self):
        """Test Phase 1: 3-Hour Timer Creation (without waiting)"""
        self.log("🧪 Testing 3-Hour Timer Creation...")
        
        treat_data = {
            "name": "3-Hour Premium Treat",
            "creator_address": self.test_player_address,
            "ingredients": ["wagyu_beef", "truffle_oil", "gold_flakes"],
            "main_ingredient": "wagyu_beef",
            "rarity": "legendary",
            "flavor": "umami", 
            "image": "3hour-treat.jpg",
            "timer_duration": 10800,  # 3 hours in seconds
            "brewing_status": "brewing"
        }
        
        response = requests.post(f"{self.base_url}/api/treats", json=treat_data)
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('timer_duration') == 10800 and data.get('brewing_status') == 'brewing':
                self.log("✅ 3-Hour Timer Creation: WORKING - Timer set correctly")
                
                # Check timer status
                treat_id = data.get('id')
                timer_response = requests.post(f"{self.base_url}/api/treats/{treat_id}/check-timer")
                
                if timer_response.status_code == 200:
                    timer_data = timer_response.json()
                    remaining = timer_data.get('remaining_seconds', 0)
                    hours = remaining // 3600
                    minutes = (remaining % 3600) // 60
                    
                    self.log(f"✅ 3-Hour Timer Status: WORKING - {hours}h {minutes}m remaining")
                    return True
                    
        self.log("❌ 3-Hour Timer Creation: FAILED")
        return False
    
    def test_leaderboard_nicknames(self):
        """Test Phase 1: Leaderboard with Nicknames"""
        self.log("🧪 Testing Leaderboard with Nicknames...")
        
        response = requests.get(f"{self.base_url}/api/leaderboard?limit=10")
        
        if response.status_code == 200:
            leaderboard = response.json()
            
            # Check if nickname field exists in response
            has_nickname_field = all('nickname' in entry for entry in leaderboard)
            
            if has_nickname_field:
                self.log("✅ Leaderboard Nicknames: WORKING - Nickname field present in all entries")
                
                # Show sample entries
                for i, entry in enumerate(leaderboard[:3]):
                    nickname = entry.get('nickname') or 'No nickname'
                    self.log(f"   Rank {entry.get('rank')}: {nickname} ({entry.get('points')} points)")
                    
                return True
            else:
                self.log("❌ Leaderboard Nicknames: FAILED - Nickname field missing")
                return False
        else:
            self.log(f"❌ Leaderboard: FAILED - Status {response.status_code}")
            return False
    
    def test_error_handling(self):
        """Test Phase 1: Error Handling for Timer Endpoints"""
        self.log("🧪 Testing Error Handling...")
        
        # Test non-existent treat timer check
        response = requests.post(f"{self.base_url}/api/treats/nonexistent-id/check-timer")
        
        if response.status_code == 404:
            self.log("✅ Error Handling: WORKING - 404 for non-existent treat timer")
        else:
            self.log(f"❌ Error Handling: FAILED - Expected 404, got {response.status_code}")
            return False
            
        # Test player creation with missing fields
        response = requests.post(f"{self.base_url}/api/player", json={})
        
        if response.status_code == 422:
            self.log("✅ Error Handling: WORKING - 422 for missing player fields")
        else:
            self.log(f"❌ Error Handling: FAILED - Expected 422, got {response.status_code}")
            return False
            
        return True

def main():
    print("🚀 DogeFood Lab Phase 1 Features Testing")
    print("Testing: Enhanced Treat Creation, Timer System, Player Nicknames")
    print("=" * 70)
    
    tester = Phase1TimerTester()
    
    tests = [
        ("Enhanced Player Registration", tester.test_enhanced_player_registration),
        ("Enhanced Treat Creation", tester.test_enhanced_treat_creation),
        ("Timer System Endpoints", tester.test_timer_system_endpoints),
        ("3-Hour Timer Creation", tester.test_3_hour_timer_creation),
        ("Leaderboard Nicknames", tester.test_leaderboard_nicknames),
        ("Error Handling", tester.test_error_handling)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
            print()  # Add spacing between tests
        except Exception as e:
            tester.log(f"❌ {test_name}: EXCEPTION - {str(e)}")
            print()
    
    print("=" * 70)
    print(f"📊 Phase 1 Testing Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL PHASE 1 FEATURES WORKING CORRECTLY!")
        print("✅ Enhanced treat creation with timer support")
        print("✅ Timer system with auto-status updates")
        print("✅ Player registration with nicknames")
        print("✅ Leaderboard with nickname display")
        print("✅ Proper error handling")
    else:
        print(f"⚠️  {total - passed} Phase 1 features need attention")
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    exit(main())