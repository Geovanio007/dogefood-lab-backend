"""
Anti-cheat system for DogeFood Lab
Monitors player behavior and detects suspicious activities
Includes daily treat limit system (5 treats per 24h + purchasable extra lives)
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass
import logging
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

# Daily limit constants
DAILY_TREAT_LIMIT = 5  # Base limit per 24 hours
EXTRA_LIFE_TREATS = 3  # Additional treats per extra life purchase
EXTRA_LIFE_COST_LAB = 5000  # Cost in $LAB tokens (not active yet)

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
        Get player's daily treat creation status
        Returns remaining treats, extra lives purchased, etc.
        """
        # Get treats created in the last 24 hours
        daily_treats = await self._get_recent_treats(player_address, hours=24)
        treats_created_today = len(daily_treats)
        
        # Get player's extra lives status
        player = await self.db.players.find_one({"address": player_address})
        extra_lives_purchased = 0
        extra_lives_used = 0
        
        if player:
            extra_lives_purchased = player.get("extra_lives_purchased_today", 0)
            extra_lives_used = player.get("extra_lives_used_today", 0)
            
            # Check if we need to reset daily counters
            last_reset = player.get("daily_reset_at")
            if last_reset:
                if isinstance(last_reset, str):
                    last_reset = datetime.fromisoformat(last_reset.replace("Z", "+00:00").replace("+00:00", ""))
                if datetime.utcnow() - last_reset > timedelta(hours=24):
                    # Reset daily counters
                    await self.db.players.update_one(
                        {"address": player_address},
                        {
                            "$set": {
                                "extra_lives_purchased_today": 0,
                                "extra_lives_used_today": 0,
                                "daily_reset_at": datetime.utcnow()
                            }
                        }
                    )
                    extra_lives_purchased = 0
        
        # Calculate total allowed treats
        base_limit = DAILY_TREAT_LIMIT
        extra_from_lives = extra_lives_purchased * EXTRA_LIFE_TREATS
        total_limit = base_limit + extra_from_lives
        
        # Calculate remaining
        remaining_treats = max(0, total_limit - treats_created_today)
        
        # Calculate time until reset
        if daily_treats:
            oldest_treat = min(daily_treats, key=lambda x: x.get("created_at", datetime.utcnow()))
            oldest_time = oldest_treat.get("created_at", datetime.utcnow())
            if isinstance(oldest_time, str):
                oldest_time = datetime.fromisoformat(oldest_time.replace("Z", "+00:00").replace("+00:00", ""))
            reset_time = oldest_time + timedelta(hours=24)
            time_until_reset = max(0, (reset_time - datetime.utcnow()).total_seconds())
        else:
            time_until_reset = 0
        
        return {
            "treats_created_today": treats_created_today,
            "base_limit": base_limit,
            "extra_lives_purchased": extra_lives_purchased,
            "extra_treats_available": extra_from_lives,
            "total_limit": total_limit,
            "remaining_treats": remaining_treats,
            "can_create_treat": remaining_treats > 0,
            "time_until_reset_seconds": int(time_until_reset),
            "extra_life_cost_lab": EXTRA_LIFE_COST_LAB,
            "extra_life_treats": EXTRA_LIFE_TREATS,
            "lab_token_active": False  # $LAB not live yet
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
        
        # NEW: Check daily limit first
        daily_status = await self.get_daily_treat_status(player_address)
        if not daily_status["can_create_treat"]:
            violations.append({
                "type": "daily_limit_reached",
                "severity": "high",
                "details": f"Daily treat limit reached ({daily_status['total_limit']} treats). Purchase extra lives or wait for reset.",
                "daily_status": daily_status
            })
            # Return immediately for daily limit - this is a hard block
            return {
                "valid": False,
                "reason": f"Daily limit reached! You've created {daily_status['treats_created_today']}/{daily_status['total_limit']} treats today. Purchase an extra life for {EXTRA_LIFE_COST_LAB} $LAB to create {EXTRA_LIFE_TREATS} more treats.",
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
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
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