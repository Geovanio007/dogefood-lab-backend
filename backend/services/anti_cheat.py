"""
Anti-cheat system for DogeFood Lab
Monitors player behavior and detects suspicious activities
Includes treat limit system (4 treats per 6h, max 16 per 24h + purchasable extra lives)
Includes streak bonus system for daily players
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass
import logging
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

# Treat limit constants - NEW SYSTEM
WINDOW_TREAT_LIMIT = 4  # Base limit per 6-hour window
WINDOW_HOURS = 6  # Hours per window
MAX_DAILY_TREATS = 16  # Maximum treats per 24 hours (4 windows x 4 treats)
EXTRA_LIFE_TREATS = 3  # Additional treats per extra life purchase
EXTRA_LIFE_COST_LAB = 5000  # Cost in $LAB tokens (not active yet)

# Streak bonus constants
STREAK_BONUSES = {
    1: {"bonus_treats": 0, "xp_multiplier": 1.0, "brewing_reduction": 0, "title": "New Chef"},
    2: {"bonus_treats": 0, "xp_multiplier": 1.05, "brewing_reduction": 0, "title": "Apprentice"},
    3: {"bonus_treats": 1, "xp_multiplier": 1.1, "brewing_reduction": 5, "title": "Rising Star"},
    5: {"bonus_treats": 1, "xp_multiplier": 1.15, "brewing_reduction": 10, "title": "Dedicated Chef"},
    7: {"bonus_treats": 2, "xp_multiplier": 1.2, "brewing_reduction": 15, "title": "Week Warrior"},
    14: {"bonus_treats": 2, "xp_multiplier": 1.3, "brewing_reduction": 20, "title": "Lab Legend"},
    30: {"bonus_treats": 3, "xp_multiplier": 1.5, "brewing_reduction": 25, "title": "Master Scientist"},
}

def get_streak_bonus(streak_days: int) -> Dict:
    """Get the bonus tier for a given streak"""
    bonus = {"bonus_treats": 0, "xp_multiplier": 1.0, "brewing_reduction": 0, "title": "New Chef", "streak_days": streak_days}
    for threshold, tier_bonus in sorted(STREAK_BONUSES.items()):
        if streak_days >= threshold:
            bonus = {**tier_bonus, "streak_days": streak_days}
    return bonus

@dataclass
class SuspiciousActivity:
    player_address: str
    activity_type: str
    timestamp: datetime
    details: Dict
    severity: str  # "low", "medium", "high"

class AntiCheatSystem:
    def __init__(self, db: AsyncIOMotorClient):
        self.db = db
        self.suspicious_activities = []
        
        # Thresholds for different activities
        self.THRESHOLDS = {
            "max_treats_per_hour": 10,
            "max_xp_per_hour": 1000,
            "min_time_between_treats": 30,  # seconds
            "max_identical_treats": 5,  # same ingredients combo
            "max_rapid_level_ups": 3,  # levels per hour
            "daily_treat_limit": DAILY_TREAT_LIMIT,  # New: daily limit
        }
        
        # Player activity cache
        self.player_cache = {}
    
    async def get_daily_treat_status(self, player_address: str) -> Dict:
        """
        Get player's treat creation status.
        NEW SYSTEM: 4 treats per 6-hour window, max 16 per 24 hours.
        Timer resets 6 hours after the FIRST treat in the current window.
        """
        now = datetime.utcnow()
        
        # Get treats created in different time windows
        treats_last_6h = await self._get_recent_treats(player_address, hours=WINDOW_HOURS)
        treats_last_24h = await self._get_recent_treats(player_address, hours=24)
        
        treats_in_window = len(treats_last_6h)
        treats_today = len(treats_last_24h)
        
        # Get player's extra lives status
        player = await self.db.players.find_one({"address": player_address})
        extra_lives_purchased = 0
        
        if player:
            extra_lives_purchased = player.get("extra_lives_purchased_today", 0)
            
            # Check if we need to reset daily counters (every 24h)
            last_reset = player.get("daily_reset_at")
            if last_reset:
                if isinstance(last_reset, str):
                    last_reset = datetime.fromisoformat(last_reset.replace("Z", "+00:00").replace("+00:00", ""))
                if now - last_reset > timedelta(hours=24):
                    await self.db.players.update_one(
                        {"address": player_address},
                        {"$set": {"extra_lives_purchased_today": 0, "daily_reset_at": now}}
                    )
                    extra_lives_purchased = 0
        
        # Get streak bonus
        streak_info = await self.get_player_streak(player_address)
        streak_bonus = get_streak_bonus(streak_info["current_streak"])
        
        # Calculate limits
        window_limit = WINDOW_TREAT_LIMIT + streak_bonus["bonus_treats"]
        daily_limit = MAX_DAILY_TREATS + (streak_bonus["bonus_treats"] * 4)  # Bonus applies to each window
        extra_from_lives = extra_lives_purchased * EXTRA_LIFE_TREATS
        
        # Calculate remaining in current window
        remaining_in_window = max(0, window_limit - treats_in_window + extra_from_lives)
        
        # Check daily cap
        remaining_daily = max(0, daily_limit - treats_today + extra_from_lives)
        
        # Actual remaining is the minimum of window and daily limits
        remaining_treats = min(remaining_in_window, remaining_daily)
        can_create = remaining_treats > 0
        
        # Calculate time until window reset (6h from first treat in window)
        time_until_reset = 0
        if treats_last_6h:
            # Find the oldest treat in the 6h window
            oldest_treat = min(treats_last_6h, key=lambda x: x.get("created_at", now))
            oldest_time = oldest_treat.get("created_at", now)
            if isinstance(oldest_time, str):
                oldest_time = datetime.fromisoformat(oldest_time.replace("Z", "+00:00").replace("+00:00", ""))
            window_reset_time = oldest_time + timedelta(hours=WINDOW_HOURS)
            time_until_reset = max(0, (window_reset_time - now).total_seconds())
        
        return {
            "treats_in_window": treats_in_window,
            "treats_today": treats_today,
            "window_limit": window_limit,
            "daily_limit": daily_limit,
            "window_hours": WINDOW_HOURS,
            "remaining_in_window": remaining_in_window,
            "remaining_daily": remaining_daily,
            "remaining_treats": remaining_treats,
            "can_create_treat": can_create,
            "time_until_reset_seconds": int(time_until_reset),
            "extra_lives_purchased": extra_lives_purchased,
            "extra_treats_available": extra_from_lives,
            "extra_life_cost_lab": EXTRA_LIFE_COST_LAB,
            "extra_life_treats": EXTRA_LIFE_TREATS,
            "lab_token_active": False,
            "streak": streak_info,
            "streak_bonus": streak_bonus,
            # Legacy fields for compatibility
            "treats_created_today": treats_today,
            "base_limit": WINDOW_TREAT_LIMIT,
            "total_limit": daily_limit
        }
    
    async def get_player_streak(self, player_address: str) -> Dict:
        """
        Get player's current streak information
        """
        player = await self.db.players.find_one({"address": player_address})
        
        if not player:
            return {
                "current_streak": 0,
                "longest_streak": 0,
                "last_play_date": None,
                "streak_active": False
            }
        
        current_streak = player.get("current_streak", 0)
        longest_streak = player.get("longest_streak", 0)
        last_play_date = player.get("last_play_date")
        
        # Check if streak is still active (played within last 48 hours to be lenient)
        streak_active = False
        if last_play_date:
            if isinstance(last_play_date, str):
                last_play_date = datetime.fromisoformat(last_play_date.replace("Z", "+00:00").replace("+00:00", ""))
            hours_since_play = (datetime.utcnow() - last_play_date).total_seconds() / 3600
            streak_active = hours_since_play < 48
        
        return {
            "current_streak": current_streak if streak_active else 0,
            "longest_streak": longest_streak,
            "last_play_date": last_play_date.isoformat() if last_play_date else None,
            "streak_active": streak_active
        }
    
    async def update_player_streak(self, player_address: str) -> Dict:
        """
        Update player's streak when they play (create a treat)
        Returns the updated streak info with bonuses
        """
        player = await self.db.players.find_one({"address": player_address})
        now = datetime.utcnow()
        today = now.date()
        
        if not player:
            # Create new player streak record
            await self.db.players.update_one(
                {"address": player_address},
                {
                    "$set": {
                        "current_streak": 1,
                        "longest_streak": 1,
                        "last_play_date": now,
                        "streak_started_at": now
                    }
                },
                upsert=True
            )
            streak_bonus = get_streak_bonus(1)
            return {
                "current_streak": 1,
                "longest_streak": 1,
                "streak_bonus": streak_bonus,
                "streak_increased": True,
                "message": "Welcome! Your streak begins! 🔥"
            }
        
        last_play_date = player.get("last_play_date")
        current_streak = player.get("current_streak", 0)
        longest_streak = player.get("longest_streak", 0)
        
        streak_increased = False
        message = ""
        
        if last_play_date:
            if isinstance(last_play_date, str):
                last_play_date = datetime.fromisoformat(last_play_date.replace("Z", "+00:00").replace("+00:00", ""))
            
            last_play_day = last_play_date.date()
            days_diff = (today - last_play_day).days
            
            if days_diff == 0:
                # Already played today, streak unchanged
                message = f"Keep cooking! 🧪 Streak: {current_streak} days"
            elif days_diff == 1:
                # Played yesterday, streak continues!
                current_streak += 1
                streak_increased = True
                if current_streak > longest_streak:
                    longest_streak = current_streak
                    message = f"🔥 NEW RECORD! {current_streak} day streak!"
                else:
                    message = f"🔥 Streak extended! {current_streak} days!"
            else:
                # Missed days, streak resets
                current_streak = 1
                streak_increased = True
                message = f"Streak reset! Starting fresh! 💪"
        else:
            # First time playing
            current_streak = 1
            longest_streak = max(1, longest_streak)
            streak_increased = True
            message = "Welcome! Your streak begins! 🔥"
        
        # Update database
        await self.db.players.update_one(
            {"address": player_address},
            {
                "$set": {
                    "current_streak": current_streak,
                    "longest_streak": longest_streak,
                    "last_play_date": now
                }
            }
        )
        
        streak_bonus = get_streak_bonus(current_streak)
        
        return {
            "current_streak": current_streak,
            "longest_streak": longest_streak,
            "streak_bonus": streak_bonus,
            "streak_increased": streak_increased,
            "message": message
        }
    
    async def purchase_extra_life(self, player_address: str) -> Dict:
        """
        Purchase an extra life for 5000 $LAB (placeholder - not functional yet)
        Returns purchase status
        """
        # Get current status
        status = await self.get_daily_treat_status(player_address)
        
        # $LAB is not live yet - return placeholder response
        return {
            "success": False,
            "reason": "lab_token_not_active",
            "message": "$LAB token is not yet live. Extra lives will be available once $LAB launches!",
            "cost": EXTRA_LIFE_COST_LAB,
            "extra_treats": EXTRA_LIFE_TREATS,
            "current_status": status
        }
    
    async def validate_treat_creation(self, player_address: str, treat_data: Dict) -> Dict:
        """
        Validate treat creation for anti-cheat
        Returns: {"valid": bool, "reason": str, "severity": str}
        """
        
        # Get player's recent activity
        recent_treats = await self._get_recent_treats(player_address, hours=1)
        
        violations = []
        
        # Check limit first (4 per 6h, max 16 per 24h)
        daily_status = await self.get_daily_treat_status(player_address)
        if not daily_status["can_create_treat"]:
            # Determine which limit was hit
            if daily_status["remaining_in_window"] <= 0:
                reason = f"Window limit reached! You've created {daily_status['treats_in_window']}/{daily_status['window_limit']} treats in the last {WINDOW_HOURS} hours."
            else:
                reason = f"Daily limit reached! You've created {daily_status['treats_today']}/{daily_status['daily_limit']} treats today."
            
            violations.append({
                "type": "limit_reached",
                "severity": "high",
                "details": reason,
                "daily_status": daily_status
            })
            return {
                "valid": False,
                "reason": reason + f" Wait for reset or get an extra life!",
                "severity": "high",
                "violations": violations,
                "daily_status": daily_status
            }
        
        # Check 1: Too many treats per hour
        if len(recent_treats) >= self.THRESHOLDS["max_treats_per_hour"]:
            violations.append({
                "type": "excessive_treat_creation",
                "severity": "high",
                "details": f"Created {len(recent_treats)} treats in the last hour (limit: {self.THRESHOLDS['max_treats_per_hour']})"
            })
        
        # Check 2: Time between treats too short
        if recent_treats:
            last_treat_time = recent_treats[0]["created_at"]
            time_diff = (datetime.utcnow() - last_treat_time).seconds
            
            if time_diff < self.THRESHOLDS["min_time_between_treats"]:
                violations.append({
                    "type": "rapid_treat_creation",
                    "severity": "medium",
                    "details": f"Created treat {time_diff}s after last one (minimum: {self.THRESHOLDS['min_time_between_treats']}s)"
                })
        
        # Check 3: Identical ingredient combinations (farming detection)
        ingredient_combo = sorted(treat_data.get("ingredients", []))
        identical_count = sum(1 for treat in recent_treats 
                            if sorted(treat.get("ingredients", [])) == ingredient_combo)
        
        if identical_count >= self.THRESHOLDS["max_identical_treats"]:
            violations.append({
                "type": "ingredient_farming",
                "severity": "medium",
                "details": f"Used identical ingredient combo {identical_count} times (limit: {self.THRESHOLDS['max_identical_treats']})"
            })
        
        # Check 4: Timer manipulation detection
        if treat_data.get("timer_duration") and treat_data.get("brewing_status") == "brewing":
            expected_timer = await self._calculate_expected_timer(player_address)
            actual_timer = treat_data.get("timer_duration")
            
            # Allow 10% variance for network delays
            if actual_timer < expected_timer * 0.9:
                violations.append({
                    "type": "timer_manipulation",
                    "severity": "high",
                    "details": f"Timer too short: {actual_timer}s (expected: ~{expected_timer}s)"
                })
        
        # Log violations
        if violations:
            await self._log_suspicious_activity(player_address, violations)
            
            # Determine if we should block this action
            high_severity = any(v["severity"] == "high" for v in violations)
            
            return {
                "valid": not high_severity,
                "reason": violations[0]["details"] if violations else "",
                "severity": violations[0]["severity"] if violations else "none",
                "violations": violations
            }
        
        return {"valid": True, "reason": "", "severity": "none", "violations": []}
    
    async def validate_xp_gain(self, player_address: str, xp_amount: int, context: Dict) -> Dict:
        """
        Validate XP gains for suspicious patterns
        """
        
        # Get player's XP history from last hour
        recent_xp = await self._get_recent_xp_gains(player_address, hours=1)
        total_xp_gained = sum(gain["amount"] for gain in recent_xp)
        
        violations = []
        
        # Check 1: Excessive XP per hour
        if total_xp_gained + xp_amount > self.THRESHOLDS["max_xp_per_hour"]:
            violations.append({
                "type": "excessive_xp_gain",
                "severity": "high",
                "details": f"Would gain {total_xp_gained + xp_amount} XP in 1 hour (limit: {self.THRESHOLDS['max_xp_per_hour']})"
            })
        
        # Check 2: Impossible XP amount for given ingredients
        ingredients = context.get("ingredients", [])
        max_possible_xp = await self._calculate_max_xp_for_ingredients(ingredients, context.get("level", 1))
        
        if xp_amount > max_possible_xp * 1.1:  # 10% tolerance
            violations.append({
                "type": "impossible_xp_amount",
                "severity": "high",
                "details": f"XP amount {xp_amount} exceeds maximum possible {max_possible_xp} for given ingredients"
            })
        
        if violations:
            await self._log_suspicious_activity(player_address, violations)
            high_severity = any(v["severity"] == "high" for v in violations)
            
            return {
                "valid": not high_severity,
                "reason": violations[0]["details"] if violations else "",
                "severity": violations[0]["severity"] if violations else "none",
                "violations": violations
            }
        
        return {"valid": True, "reason": "", "severity": "none", "violations": []}
    
    async def check_level_progression(self, player_address: str, new_level: int, old_level: int) -> Dict:
        """
        Check for suspicious level progression patterns
        """
        
        if new_level <= old_level:
            return {"valid": True, "reason": "", "severity": "none"}
        
        level_increase = new_level - old_level
        
        # Get recent level ups
        recent_level_ups = await self._get_recent_level_ups(player_address, hours=1)
        
        violations = []
        
        # Check 1: Too many level ups in short time
        if len(recent_level_ups) + level_increase > self.THRESHOLDS["max_rapid_level_ups"]:
            violations.append({
                "type": "rapid_level_progression",
                "severity": "high",
                "details": f"Would gain {len(recent_level_ups) + level_increase} levels in 1 hour (limit: {self.THRESHOLDS['max_rapid_level_ups']})"
            })
        
        # Check 2: Impossible level jump
        if level_increase > 2:  # Max 2 levels per action
            violations.append({
                "type": "impossible_level_jump",
                "severity": "high",
                "details": f"Level increase of {level_increase} in single action (max expected: 2)"
            })
        
        if violations:
            await self._log_suspicious_activity(player_address, violations)
            high_severity = any(v["severity"] == "high" for v in violations)
            
            return {
                "valid": not high_severity,
                "reason": violations[0]["details"] if violations else "",
                "severity": violations[0]["severity"] if violations else "none",
                "violations": violations
            }
        
        return {"valid": True, "reason": "", "severity": "none", "violations": []}
    
    async def get_player_risk_score(self, player_address: str) -> Dict:
        """
        Calculate overall risk score for a player based on historical activity
        """
        
        # Get all suspicious activities for player in last 24 hours
        recent_activities = await self.db.suspicious_activities.find({
            "player_address": player_address,
            "timestamp": {"$gte": datetime.utcnow() - timedelta(hours=24)}
        }).to_list(100)
        
        risk_score = 0
        severity_weights = {"low": 1, "medium": 5, "high": 15}
        
        for activity in recent_activities:
            risk_score += severity_weights.get(activity.get("severity", "low"), 1)
        
        risk_level = "low"
        if risk_score >= 50:
            risk_level = "high"
        elif risk_score >= 20:
            risk_level = "medium"
        
        return {
            "player_address": player_address,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "recent_violations": len(recent_activities),
            "last_violation": recent_activities[0]["timestamp"] if recent_activities else None
        }
    
    async def _get_recent_treats(self, player_address: str, hours: int = 1) -> List[Dict]:
        """Get player's treats from last N hours"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        treats = await self.db.treats.find({
            "creator_address": player_address,
            "created_at": {"$gte": cutoff_time}
        }).sort("created_at", -1).to_list(100)
        
        return treats
    
    async def _get_recent_xp_gains(self, player_address: str, hours: int = 1) -> List[Dict]:
        """Get player's XP gains from last N hours"""
        # This would come from an activity log in production
        # For now, estimate from treat creation
        treats = await self._get_recent_treats(player_address, hours)
        
        xp_gains = []
        for treat in treats:
            # Estimate XP based on ingredients (simplified)
            estimated_xp = len(treat.get("ingredients", [])) * 20  # Base estimation
            xp_gains.append({
                "amount": estimated_xp,
                "timestamp": treat["created_at"],
                "source": "treat_creation"
            })
        
        return xp_gains
    
    async def _get_recent_level_ups(self, player_address: str, hours: int = 1) -> List[Dict]:
        """Get player's level ups from last N hours"""
        # In production, this would come from a level_up_log collection
        # For now, return empty list (implement when activity logging is added)
        return []
    
    async def _calculate_expected_timer(self, player_address: str) -> int:
        """Calculate expected timer duration based on player level"""
        player = await self.db.players.find_one({"address": player_address})
        if not player:
            return 3600  # Default 1 hour
        
        level = player.get("level", 1)
        base_time_hours = 1
        additional_time_per_level = 0.5
        
        expected_hours = base_time_hours + (level - 1) * additional_time_per_level
        return int(expected_hours * 3600)  # Convert to seconds
    
    async def _calculate_max_xp_for_ingredients(self, ingredients: List[str], level: int) -> int:
        """Calculate maximum possible XP for given ingredients"""
        # Simplified calculation - in production, would use actual game config
        base_xp = len(ingredients) * 25  # Base XP per ingredient
        level_multiplier = 1 + (level - 1) * 0.1  # 10% per level
        max_rarity_bonus = 3.0  # Maximum rarity multiplier
        
        return int(base_xp * level_multiplier * max_rarity_bonus)
    
    async def _log_suspicious_activity(self, player_address: str, violations: List[Dict]):
        """Log suspicious activity to database"""
        for violation in violations:
            activity = {
                "player_address": player_address,
                "activity_type": violation["type"],
                "timestamp": datetime.utcnow(),
                "details": violation["details"],
                "severity": violation["severity"]
            }
            
            await self.db.suspicious_activities.insert_one(activity)
            logger.warning(f"Suspicious activity detected: {player_address} - {violation['type']}")
    
    async def cleanup_old_logs(self, days: int = 7):
        """Clean up old suspicious activity logs"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        result = await self.db.suspicious_activities.delete_many({
            "timestamp": {"$lt": cutoff_date}
        })
        
        logger.info(f"Cleaned up {result.deleted_count} old suspicious activity logs")
        
    async def get_flagged_players(self, risk_level: str = "high") -> List[Dict]:
        """Get list of players flagged for suspicious activity"""
        
        pipeline = [
            {
                "$match": {
                    "timestamp": {"$gte": datetime.utcnow() - timedelta(hours=24)}
                }
            },
            {
                "$group": {
                    "_id": "$player_address",
                    "violations": {"$sum": 1},
                    "latest_violation": {"$max": "$timestamp"},
                    "severities": {"$push": "$severity"}
                }
            },
            {
                "$match": {
                    "$expr": {"$in": [risk_level, "$severities"]}
                }
            }
        ]
        
        flagged = await self.db.suspicious_activities.aggregate(pipeline).to_list(100)
        
        return flagged