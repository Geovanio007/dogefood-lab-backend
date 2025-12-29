#!/usr/bin/env python3
"""
DogeFood Lab Database Cleanup Script
Fixes critical bugs: level inconsistencies, mock data, sack system
"""

import asyncio
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

# Database connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_client = AsyncIOMotorClient(MONGO_URL)
db = db_client.dogefood_lab

async def cleanup_player_data():
    """Clean up player data inconsistencies"""
    print("🧹 CLEANING UP PLAYER DATA...")
    
    target_address = "0x033CD94d0020B397393bF1deA4920Be0d4723DCB"
    
    # 1. Fix player level to match actual progression
    player = await db.players.find_one({"address": target_address})
    if player:
        print(f"📊 Current player data:")
        print(f"   Level: {player.get('level', 1)}")
        print(f"   XP: {player.get('experience', 0)}")  
        print(f"   Points: {player.get('points', 0)}")
        print(f"   Treats: {len(player.get('created_treats', []))}")
        
        # Reset to consistent Level 1 state
        await db.players.update_one(
            {"address": target_address},
            {
                "$set": {
                    "level": 1,
                    "experience": 0,
                    "points": 0,  # Will be recalculated from actual treats
                    "sack_progress": 0,  # Reset sack progress
                    "sack_completed_count": 0,
                    "last_updated": datetime.utcnow()
                }
            }
        )
        print("✅ Player reset to Level 1 baseline")
    
    # 2. Clean up inconsistent treats - keep only Level 1 treats or recent ones
    treats = await db.treats.find({"creator_address": target_address}).to_list(length=None)
    print(f"📊 Found {len(treats)} treats to review")
    
    treats_to_keep = []
    treats_to_remove = []
    total_real_points = 0
    
    for treat in treats:
        treat_name = treat.get('name', '')
        created_at = treat.get('created_at')
        
        # Keep only Level 1 treats or very recent treats (last 24 hours)
        is_level_1 = 'Level 1' in treat_name
        is_recent = False
        
        if created_at:
            if isinstance(created_at, str):
                try:
                    created_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    is_recent = (datetime.utcnow() - created_dt.replace(tzinfo=None)).days == 0
                except:
                    is_recent = False
            elif isinstance(created_at, datetime):
                is_recent = (datetime.utcnow() - created_at).days == 0
        
        if is_level_1 or is_recent:
            treats_to_keep.append(treat)
            # Award points for legitimate treats (10 points per treat)
            total_real_points += 10
        else:
            treats_to_remove.append(treat)
            print(f"   🗑️  Removing inconsistent treat: {treat_name}")
    
    # Remove inconsistent treats
    if treats_to_remove:
        treat_ids_to_remove = [treat['_id'] for treat in treats_to_remove]
        result = await db.treats.delete_many({"_id": {"$in": treat_ids_to_remove}})
        print(f"✅ Removed {result.deleted_count} inconsistent treats")
    
    # Update player with correct treat count and points
    remaining_treat_ids = [str(treat['_id']) for treat in treats_to_keep]
    await db.players.update_one(
        {"address": target_address},
        {
            "$set": {
                "created_treats": remaining_treat_ids,
                "points": total_real_points,
                "total_treats_created": len(treats_to_keep)
            }
        }
    )
    
    print(f"✅ Player now has {len(treats_to_keep)} legitimate treats")
    print(f"✅ Player awarded {total_real_points} points for legitimate treats")

async def fix_sack_system():
    """Fix and initialize sack system properly"""
    print("🎒 FIXING SACK SYSTEM...")
    
    target_address = "0x033CD94d0020B397393bF1deA4920Be0d4723DCB"
    
    # Get player's legitimate treats count
    player = await db.players.find_one({"address": target_address})
    if player:
        treats_count = len(player.get('created_treats', []))
        
        # Calculate sack progress (every 5 treats = 1 sack completion)
        sack_completion_threshold = 5
        sack_completed_count = treats_count // sack_completion_threshold
        sack_progress = treats_count % sack_completion_threshold
        
        # Calculate XP from sack completions (bonus XP per completion)
        sack_bonus_xp = sack_completed_count * 50  # 50 XP per sack completion
        
        await db.players.update_one(
            {"address": target_address},
            {
                "$set": {
                    "sack_progress": sack_progress,
                    "sack_completed_count": sack_completed_count,
                    "sack_bonus_xp": sack_bonus_xp,
                    "experience": sack_bonus_xp,  # Total XP from sack system
                }
            }
        )
        
        print(f"✅ Sack system fixed:")
        print(f"   Treats created: {treats_count}")
        print(f"   Sack progress: {sack_progress}/{sack_completion_threshold}")
        print(f"   Sack completions: {sack_completed_count}")
        print(f"   Bonus XP awarded: {sack_bonus_xp}")

async def fix_leaderboard():
    """Ensure player appears on leaderboard"""
    print("🏆 FIXING LEADERBOARD...")
    
    target_address = "0x033CD94d0020B397393bF1deA4920Be0d4723DCB"
    
    # Ensure player has proper leaderboard data
    player = await db.players.find_one({"address": target_address})
    if player:
        await db.players.update_one(
            {"address": target_address},
            {
                "$set": {
                    "nickname": "Player",  # Default nickname for leaderboard
                    "is_nft_holder": False,  # Set based on actual NFT status
                    "leaderboard_eligible": True,
                    "last_activity": datetime.utcnow()
                }
            }
        )
        
        print(f"✅ Player set as leaderboard eligible")
        print(f"   Points: {player.get('points', 0)}")
        print(f"   Level: {player.get('level', 1)}")

async def cleanup_all_mock_data():
    """Remove any remaining mock or test data"""
    print("🧹 CLEANING UP ALL MOCK DATA...")
    
    # Remove test players that might interfere
    test_patterns = ["test", "demo", "mock", "example"]
    
    for pattern in test_patterns:
        result = await db.players.delete_many({
            "address": {"$regex": pattern, "$options": "i"}
        })
        if result.deleted_count > 0:
            print(f"   Removed {result.deleted_count} {pattern} players")
        
        result = await db.treats.delete_many({
            "creator_address": {"$regex": pattern, "$options": "i"}
        })
        if result.deleted_count > 0:
            print(f"   Removed {result.deleted_count} {pattern} treats")
    
    print("✅ Mock data cleanup completed")

async def main():
    """Main cleanup function"""
    print("🚀 STARTING DOGEFOOD LAB DATABASE CLEANUP")
    print("=" * 60)
    
    try:
        await cleanup_player_data()
        print()
        await fix_sack_system() 
        print()
        await fix_leaderboard()
        print()
        await cleanup_all_mock_data()
        
        print()
        print("🎉 DATABASE CLEANUP COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        
        # Show final player state
        target_address = "0x033CD94d0020B397393bF1deA4920Be0d4723DCB"
        player = await db.players.find_one({"address": target_address})
        if player:
            print(f"📊 FINAL PLAYER STATE:")
            print(f"   Address: {target_address}")
            print(f"   Level: {player.get('level', 1)}")
            print(f"   XP: {player.get('experience', 0)}")
            print(f"   Points: {player.get('points', 0)}")
            print(f"   Treats: {len(player.get('created_treats', []))}")
            print(f"   Sack Progress: {player.get('sack_progress', 0)}/5")
            print(f"   Sack Completions: {player.get('sack_completed_count', 0)}")
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
    finally:
        db_client.close()

if __name__ == "__main__":
    asyncio.run(main())