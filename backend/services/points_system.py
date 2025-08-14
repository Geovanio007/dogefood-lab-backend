"""
Points collection and ranking system for DogeFood Lab
Handles off-chain point accumulation and leaderboard calculations
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
import logging
import json
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

@dataclass
class PointsTransaction:
    id: str
    player_address: str
    amount: int
    source: str  # "treat_creation", "level_up", "nft_bonus", "daily_bonus"
    timestamp: datetime
    metadata: Dict = None

@dataclass 
class RankingSnapshot:
    player_address: str
    nickname: Optional[str]
    total_points: int
    level: int
    treats_created: int
    last_active: datetime
    rank: int
    rank_change: int  # +/- from previous snapshot

class PointsCollectionSystem:
    def __init__(self, db: AsyncIOMotorClient):
        self.db = db
        
        # Points configuration
        self.POINTS_CONFIG = {
            "treat_creation": {
                "base_points": 10,
                "rarity_multipliers": {
                    "common": 1.0,
                    "rare": 1.5,
                    "epic": 2.0,
                    "legendary": 3.0
                },
                "ingredient_bonus": 2  # points per ingredient
            },
            "level_up": {
                "base_points": 50,
                "level_multiplier": 10  # additional points per level
            },
            "nft_holder_bonus": {
                "daily_bonus": 25,
                "activity_multiplier": 1.5  # 50% bonus for all activities
            },
            "streak_bonuses": {
                "daily_login": 5,
                "treat_streak": 10  # bonus for consecutive days creating treats
            }
        }
    
    async def award_points(self, player_address: str, source: str, metadata: Dict = None) -> int:
        """
        Award points to a player based on activity
        Returns: Points awarded
        """
        
        # Get player info for calculations
        player = await self.db.players.find_one({"address": player_address})
        if not player:
            logger.error(f"Player not found: {player_address}")
            return 0
        
        points_awarded = 0
        
        if source == "treat_creation":
            points_awarded = await self._calculate_treat_points(player, metadata or {})
        elif source == "level_up":
            points_awarded = await self._calculate_level_up_points(player, metadata or {})
        elif source == "daily_bonus":
            points_awarded = await self._calculate_daily_bonus(player)
        elif source == "streak_bonus":
            points_awarded = await self._calculate_streak_bonus(player, metadata or {})
        
        # Apply NFT holder bonus if applicable
        if player.get("is_nft_holder", False):
            nft_multiplier = self.POINTS_CONFIG["nft_holder_bonus"]["activity_multiplier"]
            points_awarded = int(points_awarded * nft_multiplier)
        
        # Record the transaction
        if points_awarded > 0:
            transaction = PointsTransaction(
                id=f"{player_address}_{source}_{int(datetime.utcnow().timestamp())}",
                player_address=player_address,
                amount=points_awarded,
                source=source,
                timestamp=datetime.utcnow(),
                metadata=metadata
            )
            
            await self._record_points_transaction(transaction)
            await self._update_player_points(player_address, points_awarded)
        
        return points_awarded
    
    async def _calculate_treat_points(self, player: Dict, metadata: Dict) -> int:
        """Calculate points for treat creation"""
        base_points = self.POINTS_CONFIG["treat_creation"]["base_points"]
        
        # Rarity bonus
        rarity = metadata.get("rarity", "common").lower()
        rarity_multiplier = self.POINTS_CONFIG["treat_creation"]["rarity_multipliers"].get(rarity, 1.0)
        
        # Ingredient count bonus
        ingredients_count = len(metadata.get("ingredients", []))
        ingredient_bonus = ingredients_count * self.POINTS_CONFIG["treat_creation"]["ingredient_bonus"]
        
        # Level bonus (higher level players get slightly more points)
        level_bonus = player.get("level", 1) * 2
        
        total_points = int((base_points + ingredient_bonus + level_bonus) * rarity_multiplier)
        
        logger.info(f"Treat points calculation: base={base_points}, ingredient_bonus={ingredient_bonus}, "
                   f"level_bonus={level_bonus}, rarity_multiplier={rarity_multiplier}, total={total_points}")
        
        return total_points
    
    async def _calculate_level_up_points(self, player: Dict, metadata: Dict) -> int:
        """Calculate points for leveling up"""
        base_points = self.POINTS_CONFIG["level_up"]["base_points"]
        new_level = metadata.get("new_level", player.get("level", 1))
        level_bonus = new_level * self.POINTS_CONFIG["level_up"]["level_multiplier"]
        
        return base_points + level_bonus
    
    async def _calculate_daily_bonus(self, player: Dict) -> int:
        """Calculate daily login bonus"""
        if not player.get("is_nft_holder", False):
            return 0
        
        # Check if player already claimed daily bonus today
        today = datetime.utcnow().date()
        last_daily_bonus = await self.db.points_transactions.find_one({
            "player_address": player["address"],
            "source": "daily_bonus",
            "timestamp": {
                "$gte": datetime.combine(today, datetime.min.time()),
                "$lt": datetime.combine(today + timedelta(days=1), datetime.min.time())
            }
        })
        
        if last_daily_bonus:
            return 0  # Already claimed today
        
        return self.POINTS_CONFIG["nft_holder_bonus"]["daily_bonus"]
    
    async def _calculate_streak_bonus(self, player: Dict, metadata: Dict) -> int:
        """Calculate streak bonuses"""
        streak_type = metadata.get("streak_type")
        
        if streak_type == "daily_login":
            return self.POINTS_CONFIG["streak_bonuses"]["daily_login"]
        elif streak_type == "treat_creation":
            streak_days = metadata.get("streak_days", 1)
            return self.POINTS_CONFIG["streak_bonuses"]["treat_streak"] * min(streak_days, 7)  # Cap at 7 days
        
        return 0
    
    async def _record_points_transaction(self, transaction: PointsTransaction):
        """Record points transaction in database"""
        # Convert to dict and handle datetime serialization
        transaction_dict = asdict(transaction)
        if isinstance(transaction_dict['timestamp'], datetime):
            transaction_dict['timestamp'] = transaction_dict['timestamp']  # Keep as datetime for MongoDB
        
        await self.db.points_transactions.insert_one(transaction_dict)
        
        logger.info(f"Points awarded: {transaction.player_address} +{transaction.amount} ({transaction.source})")
    
    async def _update_player_points(self, player_address: str, points: int):
        """Update player's total points"""
        await self.db.players.update_one(
            {"address": player_address},
            {"$inc": {"points": points}, "$set": {"last_active": datetime.utcnow()}}
        )
    
    async def get_player_points_history(self, player_address: str, days: int = 30) -> List[Dict]:
        """Get player's points transaction history"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        transactions = await self.db.points_transactions.find({
            "player_address": player_address,
            "timestamp": {"$gte": cutoff_date}
        }).sort("timestamp", -1).to_list(100)
        
        # Convert datetime objects to ISO strings for JSON serialization
        for transaction in transactions:
            if 'timestamp' in transaction and isinstance(transaction['timestamp'], datetime):
                transaction['timestamp'] = transaction['timestamp'].isoformat()
        
        return transactions
    
    async def calculate_player_streak(self, player_address: str) -> Dict:
        """Calculate player's current activity streaks"""
        
        # Get last 30 days of activity
        cutoff_date = datetime.utcnow() - timedelta(days=30)
        
        # Check daily login streak
        login_streak = await self._calculate_login_streak(player_address, cutoff_date)
        
        # Check treat creation streak
        treat_streak = await self._calculate_treat_creation_streak(player_address, cutoff_date)
        
        return {
            "login_streak": login_streak,
            "treat_creation_streak": treat_streak,
            "calculated_at": datetime.utcnow()
        }
    
    async def _calculate_login_streak(self, player_address: str, since_date: datetime) -> int:
        """Calculate consecutive daily login streak"""
        
        # Get unique login days (based on points transactions)
        pipeline = [
            {
                "$match": {
                    "player_address": player_address,
                    "timestamp": {"$gte": since_date}
                }
            },
            {
                "$group": {
                    "_id": {
                        "year": {"$year": "$timestamp"},
                        "month": {"$month": "$timestamp"},
                        "day": {"$dayOfMonth": "$timestamp"}
                    }
                }
            },
            {
                "$sort": {"_id": -1}
            }
        ]
        
        active_days = await self.db.points_transactions.aggregate(pipeline).to_list(30)
        
        if not active_days:
            return 0
        
        # Calculate consecutive streak from today backwards
        streak = 0
        current_date = datetime.utcnow().date()
        
        for day_data in active_days:
            day_date = datetime(day_data["_id"]["year"], day_data["_id"]["month"], day_data["_id"]["day"]).date()
            expected_date = current_date - timedelta(days=streak)
            
            if day_date == expected_date:
                streak += 1
            else:
                break
        
        return streak
    
    async def _calculate_treat_creation_streak(self, player_address: str, since_date: datetime) -> int:
        """Calculate consecutive days of treat creation"""
        
        pipeline = [
            {
                "$match": {
                    "creator_address": player_address,
                    "created_at": {"$gte": since_date}
                }
            },
            {
                "$group": {
                    "_id": {
                        "year": {"$year": "$created_at"},
                        "month": {"$month": "$created_at"},
                        "day": {"$dayOfMonth": "$created_at"}
                    }
                }
            },
            {
                "$sort": {"_id": -1}
            }
        ]
        
        treat_days = await self.db.treats.aggregate(pipeline).to_list(30)
        
        if not treat_days:
            return 0
        
        # Calculate consecutive streak
        streak = 0
        current_date = datetime.utcnow().date()
        
        for day_data in treat_days:
            day_date = datetime(day_data["_id"]["year"], day_data["_id"]["month"], day_data["_id"]["day"]).date()
            expected_date = current_date - timedelta(days=streak)
            
            if day_date == expected_date:
                streak += 1
            else:
                break
        
        return streak
    
    async def generate_leaderboard_snapshot(self) -> List[RankingSnapshot]:
        """Generate current leaderboard snapshot"""
        
        # Get all players with points
        pipeline = [
            {"$match": {"points": {"$gt": 0}}},
            {"$sort": {"points": -1, "level": -1, "last_active": -1}},
            {"$limit": 100}
        ]
        
        players = await self.db.players.aggregate(pipeline).to_list(100)
        
        # Get previous rankings for comparison
        previous_rankings = await self._get_previous_rankings()
        
        snapshots = []
        for rank, player in enumerate(players, 1):
            # Get treat count
            treat_count = await self.db.treats.count_documents({"creator_address": player["address"]})
            
            # Calculate rank change
            previous_rank = previous_rankings.get(player["address"], rank)
            rank_change = previous_rank - rank  # Positive = moved up, negative = moved down
            
            snapshot = RankingSnapshot(
                player_address=player["address"],
                nickname=player.get("nickname"),
                total_points=player["points"],
                level=player["level"],
                treats_created=treat_count,
                last_active=player["last_active"],
                rank=rank,
                rank_change=rank_change
            )
            
            snapshots.append(snapshot)
        
        # Save snapshot to database
        await self._save_leaderboard_snapshot(snapshots)
        
        return snapshots
    
    async def _get_previous_rankings(self) -> Dict[str, int]:
        """Get previous leaderboard rankings for comparison"""
        
        # Get most recent snapshot (from yesterday or last available)
        previous_snapshot = await self.db.leaderboard_snapshots.find_one(
            {"timestamp": {"$lt": datetime.utcnow() - timedelta(hours=12)}},
            sort=[("timestamp", -1)]
        )
        
        if not previous_snapshot:
            return {}
        
        return {entry["player_address"]: entry["rank"] for entry in previous_snapshot.get("rankings", [])}
    
    async def _save_leaderboard_snapshot(self, snapshots: List[RankingSnapshot]):
        """Save leaderboard snapshot to database"""
        
        snapshot_doc = {
            "timestamp": datetime.utcnow(),
            "rankings": [asdict(snapshot) for snapshot in snapshots],
            "total_players": len(snapshots)
        }
        
        await self.db.leaderboard_snapshots.insert_one(snapshot_doc)
        
        # Clean up old snapshots (keep last 30 days)
        cutoff_date = datetime.utcnow() - timedelta(days=30)
        await self.db.leaderboard_snapshots.delete_many({"timestamp": {"$lt": cutoff_date}})
    
    async def get_points_leaderboard(self, limit: int = 50, nft_holders_only: bool = True) -> List[Dict]:
        """Get current points leaderboard"""
        
        match_criteria = {"points": {"$gt": 0}}
        if nft_holders_only:
            match_criteria["is_nft_holder"] = True
        
        pipeline = [
            {"$match": match_criteria},
            {"$sort": {"points": -1, "level": -1, "last_active": -1}},
            {"$limit": limit}
        ]
        
        players = await self.db.players.aggregate(pipeline).to_list(limit)
        
        leaderboard = []
        for rank, player in enumerate(players, 1):
            # Get recent activity
            recent_points = await self.db.points_transactions.find({
                "player_address": player["address"],
                "timestamp": {"$gte": datetime.utcnow() - timedelta(days=7)}
            }).to_list(100)
            
            weekly_points = sum(t["amount"] for t in recent_points)
            
            leaderboard.append({
                "rank": rank,
                "address": player["address"],
                "nickname": player.get("nickname"),
                "total_points": player["points"],
                "weekly_points": weekly_points,
                "level": player["level"],
                "is_nft_holder": player["is_nft_holder"],
                "last_active": player["last_active"]
            })
        
        return leaderboard
    
    async def get_player_stats(self, player_address: str) -> Dict:
        """Get comprehensive player statistics"""
        
        player = await self.db.players.find_one({"address": player_address})
        if not player:
            return {}
        
        # Get points history
        points_history = await self.get_player_points_history(player_address, days=30)
        
        # Calculate streaks
        streaks = await self.calculate_player_streak(player_address)
        
        # Get treat stats
        treat_count = await self.db.treats.count_documents({"creator_address": player_address})
        
        # Get points breakdown by source
        points_breakdown = await self.db.points_transactions.aggregate([
            {"$match": {"player_address": player_address}},
            {"$group": {"_id": "$source", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
        ]).to_list(100)
        
        return {
            "player": {
                "address": player["address"],
                "nickname": player.get("nickname"),
                "level": player["level"],
                "total_points": player["points"],
                "is_nft_holder": player["is_nft_holder"],
                "last_active": player["last_active"]
            },
            "activity": {
                "treats_created": treat_count,
                "login_streak": streaks["login_streak"],
                "treat_creation_streak": streaks["treat_creation_streak"],
                "recent_transactions": len([t for t in points_history if t["timestamp"] > datetime.utcnow() - timedelta(days=7)])
            },
            "points_breakdown": {item["_id"]: {"total": item["total"], "count": item["count"]} for item in points_breakdown}
        }