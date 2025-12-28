#!/usr/bin/env python3

import requests
import json
import time

class UserRegistrationTester:
    def __init__(self, base_url="https://shiba-gamelab.preview.emergentagent.com"):
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
                    print(f"   Response: {json.dumps(response_data, indent=2)[:300]}...")
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

    def test_user_registration_system_review_request(self):
        """Test the user registration system as specified in the review request"""
        print("\n🔐 USER REGISTRATION SYSTEM TESTING - REVIEW REQUEST")
        print("=" * 70)
        print("Focus: Test registration API with exact data from review request")
        
        all_success = True
        
        # Test data from review request
        test_wallet_1 = "0xREGISTRATION_TEST_12345678901234567890"
        test_wallet_2 = "0xREGISTRATION_TEST_09876543210987654321"
        test_username_1 = "NewDogeScientist"
        test_username_2 = "AnotherUsername"
        
        # 1. Test Registration API Functionality
        print(f"\n🧪 1. REGISTRATION API FUNCTIONALITY")
        print(f"Testing POST /api/players/register with:")
        print(f"   Wallet: {test_wallet_1}")
        print(f"   Username: {test_username_1}")
        
        registration_data_1 = {
            "address": test_wallet_1,
            "username": test_username_1,
            "signature": "mock_signature_12345",
            "message": "Register for DogeFood Lab"
        }
        
        success, response = self.run_test(
            "Register New Player", 
            "POST", 
            "players/register", 
            200, 
            data=registration_data_1
        )
        
        if success and response:
            print(f"   ✅ Registration successful")
            print(f"   📝 Username: {response.get('username', 'N/A')}")
            print(f"   🔗 Address: {response.get('address', 'N/A')}")
            print(f"   🆔 Player ID: {response.get('player_id', 'N/A')}")
        else:
            print(f"   ❌ Registration failed")
            all_success = False
        
        # 2. Test Player Retrieval
        print(f"\n🔍 2. PLAYER RETRIEVAL")
        print(f"Testing GET /api/player/{test_wallet_1}")
        
        success, response = self.run_test(
            "Get Registered Player", 
            "GET", 
            f"player/{test_wallet_1}", 
            200
        )
        
        if success and response:
            nickname = response.get('nickname')
            address = response.get('address')
            
            print(f"   ✅ Player retrieved successfully")
            print(f"   📝 Nickname: {nickname}")
            print(f"   🔗 Address: {address}")
            
            # Verify nickname field is properly stored and returned
            if nickname == test_username_1:
                print(f"   ✅ Nickname field properly stored and returned")
            else:
                print(f"   ❌ CRITICAL ISSUE: Nickname field mismatch")
                print(f"       Expected: '{test_username_1}'")
                print(f"       Got: '{nickname}'")
                all_success = False
                
            # Verify all player data fields are correct
            required_fields = ['address', 'nickname', 'level', 'experience', 'points']
            missing_fields = [field for field in required_fields if field not in response]
            if not missing_fields:
                print(f"   ✅ All player data fields present")
            else:
                print(f"   ❌ Missing player data fields: {missing_fields}")
                all_success = False
        else:
            print(f"   ❌ Player retrieval failed")
            all_success = False
        
        # 3. Test Username Uniqueness (should fail with 409)
        print(f"\n🚫 3. USERNAME UNIQUENESS")
        print(f"Testing duplicate username with different wallet:")
        print(f"   Wallet: {test_wallet_2}")
        print(f"   Username: {test_username_1} (same as first registration)")
        
        registration_data_duplicate_username = {
            "address": test_wallet_2,
            "username": test_username_1,  # Same username as first registration
            "signature": "mock_signature_67890",
            "message": "Register for DogeFood Lab"
        }
        
        success, response = self.run_test(
            "Register with Duplicate Username (Should Fail)", 
            "POST", 
            "players/register", 
            409,  # Expecting 409 Conflict
            data=registration_data_duplicate_username
        )
        
        if success:
            print(f"   ✅ Username uniqueness validation working (409 returned)")
            if response and 'detail' in response:
                print(f"   📝 Error message: {response['detail']}")
        else:
            print(f"   ❌ CRITICAL ISSUE: Username uniqueness validation failed")
            print(f"       Duplicate username was allowed when it should be rejected")
            all_success = False
        
        # 4. Test Wallet Uniqueness (should fail with 409)
        print(f"\n🔒 4. WALLET UNIQUENESS")
        print(f"Testing duplicate wallet with different username:")
        print(f"   Wallet: {test_wallet_1} (same as first registration)")
        print(f"   Username: {test_username_2}")
        
        registration_data_duplicate_wallet = {
            "address": test_wallet_1,  # Same wallet as first registration
            "username": test_username_2,  # Different username
            "signature": "mock_signature_99999",
            "message": "Register for DogeFood Lab"
        }
        
        success, response = self.run_test(
            "Register with Duplicate Wallet (Should Fail)", 
            "POST", 
            "players/register", 
            409,  # Expecting 409 Conflict
            data=registration_data_duplicate_wallet
        )
        
        if success:
            print(f"   ✅ Wallet uniqueness validation working (409 returned)")
            if response and 'detail' in response:
                print(f"   📝 Error message: {response['detail']}")
        else:
            print(f"   ❌ CRITICAL ISSUE: Wallet uniqueness validation failed")
            print(f"       Duplicate wallet was allowed when it should be rejected")
            all_success = False
        
        # Final assessment
        print(f"\n🎯 USER REGISTRATION SYSTEM TEST RESULTS:")
        if all_success:
            print(f"   ✅ ALL TESTS PASSED")
            print(f"   ✅ Registration API functionality working")
            print(f"   ✅ Player retrieval with nickname working")
            print(f"   ✅ Username uniqueness validation working")
            print(f"   ✅ Wallet uniqueness validation working")
        else:
            print(f"   ❌ SOME TESTS FAILED")
            print(f"   🔧 Critical issues found that need fixing")
        
        return all_success, {
            "registration_api": True,
            "player_retrieval": True,
            "username_uniqueness": True,
            "wallet_uniqueness": True
        }

def main():
    print("🐕 DogeFood Lab User Registration System Testing 🧪")
    print("Testing as requested in review: database cleanup verification")
    print("=" * 80)
    
    tester = UserRegistrationTester()
    
    # Run the specific test from review request
    success, results = tester.test_user_registration_system_review_request()
    
    # Final Results
    print("\n" + "=" * 80)
    print("🎯 FINAL TEST RESULTS")
    print("=" * 80)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if success:
        print(f"\n✅ USER REGISTRATION SYSTEM WORKING CORRECTLY")
        print(f"✅ All functionality verified as requested in review")
    else:
        print(f"\n❌ USER REGISTRATION SYSTEM HAS ISSUES")
        print(f"❌ Critical problems found that need attention")
    
    return success

if __name__ == "__main__":
    main()