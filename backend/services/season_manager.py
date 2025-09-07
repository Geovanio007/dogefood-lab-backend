"""
Season Management System
Handles 3-month seasons, player progress tracking, and season transitions
for the DogeFood Lab game.
"""

from typing import Dict, List
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum


class SeasonStatus(Enum):
    UPCOMING = "upcoming"
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


@dataclass
class Season:
    season_id: int
    name: str
    start_date: datetime
    end_date: datetime
    status: SeasonStatus
    reward_pool_tokens: int = 0
    total_participants: int = 0
    total_treats_created: int = 0
    description: str = ""
    special_events: List[str] = None


class SeasonManager:
    def __init__(self, db_connection=None):
        """
        Initialize season manager
        
        Args:
            db_connection: Database connection for persistence
        """
        self.db = db_connection
        self.season_duration_months = 3
        self.start_date = datetime(2024, 1, 1)  # Game launch date
        
    def get_current_season_id(self) -> int:
        """Calculate current season ID based on start date and 3-month cycles"""
        # For Season 1 offchain testing, always return Season 1
        return 1
        
        # Original logic (commented out for testing)
        # current_date = datetime.now()
        # months_elapsed = (
        #     (current_date.year - self.start_date.year) * 12 + 
        #     current_date.month - self.start_date.month
        # )
        # return (months_elapsed // self.season_duration_months) + 1
    
    def get_season_dates(self, season_id: int) -> tuple[datetime, datetime]:
        """Get start and end dates for a specific season"""
        # Calculate season start (3 months per season)
        months_offset = (season_id - 1) * self.season_duration_months
        start_date = self.start_date + timedelta(days=months_offset * 30)  # Approximate
        
        # More precise calculation
        start_year = self.start_date.year
        start_month = self.start_date.month + months_offset
        
        # Handle year rollover
        while start_month > 12:
            start_month -= 12
            start_year += 1
        
        start_date = datetime(start_year, start_month, 1)
        
        # Calculate end date (3 months later)
        end_month = start_month + self.season_duration_months
        end_year = start_year
        
        while end_month > 12:
            end_month -= 12
            end_year += 1
        
        # Last day of the season
        if end_month == 1:  # If January, go to December of previous year
            end_date = datetime(end_year - 1, 12, 31, 23, 59, 59)
        else:
            end_date = datetime(end_year, end_month - 1, 
                              self._get_last_day_of_month(end_year, end_month - 1), 
                              23, 59, 59)
        
        return start_date, end_date
    
    def _get_last_day_of_month(self, year: int, month: int) -> int:
        """Get the last day of a given month/year"""
        if month in [1, 3, 5, 7, 8, 10, 12]:
            return 31
        elif month in [4, 6, 9, 11]:
            return 30
        else:  # February
            if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0):
                return 29  # Leap year
            return 28
    
    def get_season_info(self, season_id: int = None) -> Season:
        """
        Get complete season information
        
        Args:
            season_id: Season ID (defaults to current season)
            
        Returns:
            Season object with complete information
        """
        if season_id is None:
            season_id = self.get_current_season_id()
        
        # For Season 1, force it to be active for the beta launch
        if season_id == 1:
            start_date = datetime(2024, 1, 1)
            end_date = datetime(2025, 12, 31)  # Extended for beta
            status = SeasonStatus.ACTIVE
        else:
            start_date, end_date = self.get_season_dates(season_id)
            current_date = datetime.now()
            
            # Determine season status
            if current_date < start_date:
                status = SeasonStatus.UPCOMING
            elif current_date <= end_date:
                status = SeasonStatus.ACTIVE
            else:
                # Check if it's recently completed or archived
                days_since_end = (current_date - end_date).days
                if days_since_end <= 30:  # 30 days grace period
                    status = SeasonStatus.COMPLETED
                else:
                    status = SeasonStatus.ARCHIVED
        
        # Generate season name
        season_names = self._generate_season_names()
        season_name = season_names.get(season_id, f"Season {season_id}")
        
        return Season(
            season_id=season_id,
            name=season_name,
            start_date=start_date,
            end_date=end_date,
            status=status,
            description=self._get_season_description(season_id)
        )
    
    def _generate_season_names(self) -> Dict[int, str]:
        """Generate themed names for seasons"""
        season_themes = [
            "Season 1 - Offchain Launch",  # Season 1 specific
            "Spring Awakening",
            "Summer Flavor Explosion", 
            "Autumn Harvest Celebration",
            "Holiday Magic Season",
            "New Year Fresh Start",
            "Love & Treats Season",
            "Adventure Time",
            "Golden Retriever Games",
            "Spooky Treats Halloween",
            "Thanksgiving Feast",
            "Winter Wonderland"
        ]
        
        # Cycle through themes
        names = {}
        for i in range(1, 100):  # Generate names for first 100 seasons
            theme_index = (i - 1) % len(season_themes)
            cycle = (i - 1) // len(season_themes) + 1
            
            if cycle == 1:
                names[i] = season_themes[theme_index]
            else:
                names[i] = f"{season_themes[theme_index]} {cycle}"
        
        return names
    
    def _get_season_description(self, season_id: int) -> str:
        """Get description for a specific season"""
        descriptions = {
            1: "The inaugural season! Create amazing treats and compete for the first-ever $LAB token rewards.",
            2: "Spring brings new ingredients and enhanced gameplay mechanics. What legendary treats will you create?",
            3: "Summer heat means sizzling competition! New secret combos have been discovered...",
            4: "Autumn harvest unlocks premium ingredients. The stakes are higher than ever!",
        }
        
        default_desc = f"Season {season_id} - Continue your journey to become the ultimate DogeFood creator!"
        return descriptions.get(season_id, default_desc)
    
    async def get_season_leaderboard(self, season_id: int, limit: int = 50) -> List[Dict]:
        """
        Get season-specific leaderboard
        
        Args:
            season_id: Season ID
            limit: Maximum number of entries to return
            
        Returns:
            List of leaderboard entries for the season
        """
        if self.db is None:
            return []  # Mock data if no DB connection
        
        # Get season date range
        start_date, end_date = self.get_season_dates(season_id)
        
        # Query treats created during this season
        pipeline = [
            {
                "$match": {
                    "created_at": {
                        "$gte": start_date,
                        "$lte": end_date
                    }
                }
            },
            {
                "$group": {
                    "_id": "$creator_address",
                    "treats_created": {"$sum": 1},
                    "legendary_treats": {
                        "$sum": {"$cond": [{"$eq": ["$rarity", "Legendary"]}, 1, 0]}
                    },
                    "epic_treats": {
                        "$sum": {"$cond": [{"$eq": ["$rarity", "Epic"]}, 1, 0]}
                    },
                    "rare_treats": {
                        "$sum": {"$cond": [{"$eq": ["$rarity", "Rare"]}, 1, 0]}
                    },
                    "total_ingredients": {"$sum": {"$size": "$ingredients"}}
                }
            },
            {
                "$lookup": {
                    "from": "players",
                    "localField": "_id", 
                    "foreignField": "address",
                    "as": "player_info"
                }
            },
            {
                "$unwind": "$player_info"
            },
            {
                "$project": {
                    "address": "$_id",
                    "nickname": "$player_info.nickname",
                    "treats_created": 1,
                    "legendary_treats": 1,
                    "epic_treats": 1,
                    "rare_treats": 1,
                    "total_ingredients": 1,
                    "season_score": {
                        "$add": [
                            "$treats_created",
                            {"$multiply": ["$legendary_treats", 10]},
                            {"$multiply": ["$epic_treats", 5]},
                            {"$multiply": ["$rare_treats", 2]}
                        ]
                    }
                }
            },
            {"$sort": {"season_score": -1, "treats_created": -1}},
            {"$limit": limit}
        ]
        
        try:
            results = await self.db.treats.aggregate(pipeline).to_list(limit)
            
            # Add rank
            for i, entry in enumerate(results):
                entry["rank"] = i + 1
                entry["season_id"] = season_id
            
            return results
        except Exception as e:
            print(f"Error getting season leaderboard: {e}")
            return []
    
    async def get_season_stats(self, season_id: int) -> Dict:
        """
        Get comprehensive statistics for a season
        
        Args:
            season_id: Season ID
            
        Returns:
            Dictionary with season statistics
        """
        if self.db is None:
            # Return mock stats if no DB
            return {
                "season_id": season_id,
                "total_participants": 0,
                "total_treats": 0,
                "rarity_distribution": {"Common": 0, "Rare": 0, "Epic": 0, "Legendary": 0},
                "most_used_ingredient": "strawberry",
                "average_ingredients_per_treat": 3.2
            }
        
        start_date, end_date = self.get_season_dates(season_id)
        
        try:
            # Total participants
            participants = await self.db.treats.distinct("creator_address", {
                "created_at": {"$gte": start_date, "$lte": end_date}
            })
            
            # Total treats
            total_treats = await self.db.treats.count_documents({
                "created_at": {"$gte": start_date, "$lte": end_date}
            })
            
            # Rarity distribution
            rarity_pipeline = [
                {"$match": {"created_at": {"$gte": start_date, "$lte": end_date}}},
                {"$group": {"_id": "$rarity", "count": {"$sum": 1}}}
            ]
            rarity_results = await self.db.treats.aggregate(rarity_pipeline).to_list(None)
            rarity_distribution = {item["_id"]: item["count"] for item in rarity_results}
            
            # Most used ingredient
            ingredient_pipeline = [
                {"$match": {"created_at": {"$gte": start_date, "$lte": end_date}}},
                {"$unwind": "$ingredients"},
                {"$group": {"_id": "$ingredients", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 1}
            ]
            ingredient_results = await self.db.treats.aggregate(ingredient_pipeline).to_list(1)
            most_used = ingredient_results[0]["_id"] if ingredient_results else "unknown"
            
            # Average ingredients per treat
            avg_pipeline = [
                {"$match": {"created_at": {"$gte": start_date, "$lte": end_date}}},
                {"$group": {"_id": None, "avg_ingredients": {"$avg": {"$size": "$ingredients"}}}}
            ]
            avg_results = await self.db.treats.aggregate(avg_pipeline).to_list(1)
            avg_ingredients = round(avg_results[0]["avg_ingredients"], 1) if avg_results else 0
            
            return {
                "season_id": season_id,
                "total_participants": len(participants),
                "total_treats": total_treats,
                "rarity_distribution": rarity_distribution,
                "most_used_ingredient": most_used,
                "average_ingredients_per_treat": avg_ingredients,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            }
            
        except Exception as e:
            print(f"Error getting season stats: {e}")
            return {"error": str(e)}
    
    def list_seasons(self, include_upcoming: bool = True, include_archived: bool = False) -> List[Season]:
        """
        List all seasons with filtering options
        
        Args:
            include_upcoming: Include future seasons
            include_archived: Include old archived seasons
            
        Returns:
            List of Season objects
        """
        current_season_id = self.get_current_season_id()
        seasons = []
        
        # Determine range of seasons to include
        start_season = max(1, current_season_id - 5) if not include_archived else 1
        end_season = current_season_id + 2 if include_upcoming else current_season_id
        
        for season_id in range(start_season, end_season + 1):
            season = self.get_season_info(season_id)
            
            # Filter based on preferences
            if not include_upcoming and season.status == SeasonStatus.UPCOMING:
                continue
            if not include_archived and season.status == SeasonStatus.ARCHIVED:
                continue
            
            seasons.append(season)
        
        return seasons
    
    def get_time_remaining_in_season(self, season_id: int = None) -> Dict:
        """
        Get time remaining in current or specified season
        
        Args:
            season_id: Season ID (defaults to current)
            
        Returns:
            Dictionary with time remaining information
        """
        if season_id is None:
            season_id = self.get_current_season_id()
        
        season = self.get_season_info(season_id)
        current_time = datetime.now()
        
        if season.status == SeasonStatus.UPCOMING:
            time_diff = season.start_date - current_time
            return {
                "status": "upcoming",
                "time_until_start": {
                    "days": time_diff.days,
                    "hours": time_diff.seconds // 3600,
                    "minutes": (time_diff.seconds % 3600) // 60
                }
            }
        elif season.status == SeasonStatus.ACTIVE:
            time_diff = season.end_date - current_time
            return {
                "status": "active",
                "time_remaining": {
                    "days": time_diff.days,
                    "hours": time_diff.seconds // 3600,
                    "minutes": (time_diff.seconds % 3600) // 60
                }
            }
        else:
            return {
                "status": season.status.value,
                "message": "Season has ended"
            }


# Testing and example usage
def test_season_manager():
    """Test season manager functionality"""
    manager = SeasonManager()
    
    print("Season Manager Testing:")
    
    # Current season info
    current = manager.get_season_info()
    print(f"\nCurrent Season: {current.season_id} - {current.name}")
    print(f"Status: {current.status.value}")
    print(f"Dates: {current.start_date.strftime('%Y-%m-%d')} to {current.end_date.strftime('%Y-%m-%d')}")
    
    # Time remaining
    time_info = manager.get_time_remaining_in_season()
    print(f"Time info: {time_info}")
    
    # List seasons
    seasons = manager.list_seasons()
    print(f"\nAvailable seasons:")
    for season in seasons:
        print(f"  {season.season_id}: {season.name} ({season.status.value})")


if __name__ == "__main__":
    test_season_manager()