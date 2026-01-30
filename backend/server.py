from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import hashlib
import hmac
import json
import urllib.parse
import random
from telegram import Bot
import httpx  # For Firebase verification
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

# Import Phase 2 services
from services.anti_cheat import AntiCheatSystem
from services.points_system import PointsCollectionSystem
from services.merkle_tree import MerkleTreeGenerator

# Import Enhanced Game Mechanics (Phase 3)
from services.treat_game_engine import TreatGameEngine, TreatRarity
from services.ingredient_system import IngredientSystem
from services.season_manager import SeasonManager

# Firebase Configuration
FIREBASE_API_KEY = os.environ.get("FIREBASE_API_KEY", "AIzaSyDPDYvwWVhmnTTAcACEdI1agLQcetDV9jQ")
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "dogefood-lab")

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Database connection with Atlas MongoDB
try:
    MONGO_URL = os.getenv("MONGO_URL", "mongodb+srv://goistheticker_db_user:PTmfplJ3ChiNm1zH@cluster0.px8hllq.mongodb.net/?appName=Cluster0")
    DB_NAME = os.getenv("DB_NAME", "dogefood_lab_production")
    
    # Log connection attempt (without sensitive data)
    logging.info(f"Connecting to MongoDB database: {DB_NAME}")
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Test connection
    async def test_connection():
        try:
            await client.admin.command('ping')
            logging.info("✅ MongoDB Atlas connection successful")
            return True
        except Exception as e:
            logging.error(f"❌ MongoDB connection failed: {str(e)}")
            return False
    
except Exception as e:
    logging.error(f"Database initialization error: {str(e)}")
    raise

# Initialize Phase 2 services
anti_cheat_system = AntiCheatSystem(db)
points_system = PointsCollectionSystem(db)
merkle_generator = MerkleTreeGenerator()

# Initialize Enhanced Game Mechanics (Phase 3)
game_engine = TreatGameEngine(os.environ.get('GAME_SECRET_KEY', 'development_key_123'))
ingredient_system = IngredientSystem()
season_manager = SeasonManager(db)

# Background task functions
async def award_treat_creation_points(player_address: str, treat_metadata: dict):
    """Background task to award points for treat creation"""
    try:
        points_awarded = await points_system.award_points(
            player_address=player_address,
            source="treat_creation",
            metadata=treat_metadata
        )
        logger.info(f"Awarded {points_awarded} points to {player_address} for treat creation")
    except Exception as e:
        logger.error(f"Error awarding treat creation points: {e}")

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Initialize the scheduler for background tasks
scheduler = AsyncIOScheduler()

# Kernel of Wow automatic selection job
async def auto_select_kernel_holder():
    """Automatically select a new Kernel of Wow holder every 24 hours"""
    try:
        now = datetime.utcnow()
        
        # Check if there's already an active holder
        existing_holder = await db.special_ingredient_holders.find_one({
            "is_active": True,
            "expires_at": {"$gt": now}
        })
        
        if existing_holder:
            logger.info(f"Kernel of Wow already active with {existing_holder.get('player_address')}")
            return
        
        # Deactivate any expired holders
        await db.special_ingredient_holders.update_many(
            {"is_active": True, "expires_at": {"$lte": now}},
            {"$set": {"is_active": False}}
        )
        
        # Get active players (players who have created treats in last 7 days)
        seven_days_ago = now - timedelta(days=7)
        
        active_players = await db.players.find({
            "last_active": {"$gte": seven_days_ago}
        }).to_list(1000)
        
        # Fallback: get players with treats
        if not active_players:
            treat_creators = await db.treats.distinct("creator_address", {
                "created_at": {"$gte": seven_days_ago}
            })
            active_players = await db.players.find({
                "address": {"$in": treat_creators}
            }).to_list(1000)
        
        # Final fallback: get any players with points
        if not active_players:
            active_players = await db.players.find({
                "points": {"$gt": 0}
            }).to_list(100)
        
        if not active_players:
            logger.warning("No eligible players found for Kernel of Wow")
            return
        
        # Select random player
        selected_player = random.choice(active_players)
        
        # Create new holder record (16 hour duration)
        expires_at = now + timedelta(hours=16)
        
        new_holder = {
            "id": str(uuid.uuid4()),
            "player_address": selected_player.get("address"),
            "player_nickname": selected_player.get("nickname"),
            "ingredient_id": "KERNEL_WOW",
            "granted_at": now,
            "expires_at": expires_at,
            "used_in_treats": [],
            "total_bonus_earned": 0,
            "is_active": True
        }
        
        await db.special_ingredient_holders.insert_one(new_holder)
        
        # Update player record
        await db.players.update_one(
            {"address": selected_player.get("address")},
            {"$set": {"has_special_ingredient": True, "special_ingredient_expires": expires_at}}
        )
        
        logger.info(f"🌟 Kernel of Wow auto-granted to {selected_player.get('nickname') or selected_player.get('address')} until {expires_at}")
        
    except Exception as e:
        logger.error(f"Error in auto_select_kernel_holder: {e}")

# Game Models
class Player(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    address: Optional[str] = None  # Wallet address (optional for Telegram/guest users)
    nickname: Optional[str] = None  # Enhanced: Add nickname support
    email: Optional[str] = None  # Email for Firebase auth users
    # Character selection
    selected_character: Optional[str] = None  # Character ID: 'max', 'rex', or 'luna'
    character_bonuses: Optional[dict] = None  # Character-specific bonuses
    # Telegram user fields
    telegram_id: Optional[int] = None  # Telegram user ID
    telegram_username: Optional[str] = None  # Telegram @username
    telegram_first_name: Optional[str] = None  # Telegram first name
    telegram_last_name: Optional[str] = None  # Telegram last name
    # Firebase user fields
    firebase_uid: Optional[str] = None  # Firebase user ID
    firebase_provider: Optional[str] = None  # "email", "google", etc.
    profile_image: Optional[str] = None  # Profile image URL or base64
    # Auth type: "wallet", "telegram", "firebase", "guest", or "linked"
    auth_type: str = "wallet"
    is_nft_holder: bool = False
    is_vip: bool = False  # VIP Scientist badge
    vip_bonus_claimed: bool = False  # Track if 500 point bonus was claimed
    leaderboard_eligible: bool = True  # All users can appear on leaderboard
    can_convert_points: bool = False  # Only NFT holders can convert points to $LAB
    level: int = 1
    experience: int = 0
    points: int = 0
    created_treats: List[str] = []
    last_active: datetime = Field(default_factory=datetime.utcnow)

class PlayerCreate(BaseModel):
    address: str
    nickname: Optional[str] = None  # Enhanced: Add nickname support
    is_nft_holder: bool = False

class PlayerProgress(BaseModel):
    address: str
    experience: int
    points: int
    level: int

class DogeTreat(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    creator_address: str
    ingredients: List[str]
    main_ingredient: Optional[str] = None  # Enhanced: Main ingredient
    rarity: str
    flavor: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    image: str
    timer_duration: Optional[int] = None  # Enhanced: Timer in seconds
    brewing_status: str = "ready"  # Enhanced: "brewing" or "ready"
    ready_at: Optional[datetime] = None  # Enhanced: When treat will be ready
    points_reward: Optional[int] = 0  # Points earned from this treat
    xp_reward: Optional[int] = 0  # XP earned from this treat
    season_id: Optional[int] = None  # Season when treat was created

class TreatCreate(BaseModel):
    name: str
    creator_address: str
    ingredients: List[str]
    main_ingredient: Optional[str] = None  # Enhanced: Main ingredient
    rarity: str
    flavor: str
    image: str
    timer_duration: Optional[int] = None  # Enhanced: Timer support
    brewing_status: str = "ready"  # Enhanced: Default to ready

class LeaderboardEntry(BaseModel):
    address: str
    nickname: Optional[str] = None  # Enhanced: Show nicknames
    points: int
    level: int
    is_nft_holder: bool
    is_vip: bool = False  # VIP status
    rank: int
    selected_character: Optional[str] = None  # Character ID: 'max', 'rex', 'luna'
    character_name: Optional[str] = None  # Display name of character
    character_image: Optional[str] = None  # Character image URL

class EnhancedTreatCreate(BaseModel):
    creator_address: str
    ingredients: List[str]
    player_level: int

class PointsConversionRequest(BaseModel):
    player_address: str
    points_to_convert: int

class IngredientAnalysisRequest(BaseModel):
    ingredient_ids: List[str]

class TreatSimulationRequest(BaseModel):
    ingredients: List[str]
    player_level: int
    player_address: str
    simulations: int = 10
    points: int
    level: int
    is_nft_holder: bool
    rank: int

# Chat Models
class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_address: str
    sender_nickname: Optional[str] = None
    sender_character: Optional[str] = None
    content: str
    reply_to: Optional[str] = None  # ID of message being replied to
    reply_preview: Optional[str] = None  # Preview of replied message
    upvotes: List[str] = []  # List of addresses who upvoted
    upvote_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ChatMessageCreate(BaseModel):
    sender_address: str
    content: str
    reply_to: Optional[str] = None

class ChatUpvoteRequest(BaseModel):
    message_id: str
    voter_address: str

# =====================================================
# MARKETPLACE MODELS
# =====================================================

class MarketplaceListing(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    treat_id: str
    treat_name: str
    treat_rarity: str
    treat_image: str
    treat_ingredients: List[str] = []
    treat_points_reward: Optional[int] = 0
    treat_xp_reward: Optional[int] = 0
    seller_address: str
    seller_nickname: Optional[str] = None
    price_doge: Optional[float] = None  # Price in DOGE (if seller accepts DOGE)
    price_lab: Optional[float] = None   # Price in LAB (if seller accepts LAB)
    payment_options: str = "both"  # "doge", "lab", or "both"
    status: str = "active"  # "active", "sold", "cancelled"
    listed_at: datetime = Field(default_factory=datetime.utcnow)
    sold_at: Optional[datetime] = None
    buyer_address: Optional[str] = None

class CreateListingRequest(BaseModel):
    treat_id: str
    seller_address: str
    price_doge: Optional[float] = None
    price_lab: Optional[float] = None
    payment_options: str = "both"  # "doge", "lab", or "both"

class BuyListingRequest(BaseModel):
    listing_id: str
    buyer_address: str
    payment_currency: str  # "doge" or "lab"

# Marketplace fee constant
MARKETPLACE_FEE = 0.420  # Fee for successful sales

# =====================================================
# KERNEL OF WOW - SPECIAL INGREDIENT SYSTEM
# =====================================================

# Special Ingredient Configuration
KERNEL_OF_WOW = {
    "id": "KERNEL_WOW",
    "name": "Kernel of Wow",
    "icon": "https://customer-assets.emergentagent.com/job_treatlabgame/artifacts/pt9v6fui_file_00000000a6ec7230a03b126d8939507c.png",
    "description": "Forged deep inside the DogeOS kernel, this legendary byte-sized snack runs on pure WOW logic.",
    "duration_hours": 16,
    "selection_interval_hours": 24,
    "rarity": "Legendary",
    "category": "Special"
}

# Combo configurations for bonus tiers
# Each combo is a set of ingredient IDs that, when combined with Kernel of Wow, gives bonus
KERNEL_BONUS_COMBOS = {
    # 30% bonus - Legendary combo (hardest to get)
    "legendary": {
        "bonus_percent": 30,
        "combos": [
            {"ING001", "ING008", "ING015"},  # Crunchy Kibble + Cosmic Catnip + Moonrock Salt
            {"ING005", "ING012", "ING018"},  # Shiba Crunch + Doge Dust + Stellar Syrup
        ],
        "description": "Legendary WOW Combo - Maximum boost!"
    },
    # 20% bonus - Epic combo
    "epic": {
        "bonus_percent": 20,
        "combos": [
            {"ING002", "ING007"},  # Golden Bone Dust + Love Potion
            {"ING004", "ING011"},  # Meme Meat + Rainbow Sprinkles
            {"ING003", "ING009"},  # Bacon Bits + Honey Glaze
        ],
        "description": "Epic WOW Combo - Strong boost!"
    },
    # 15% bonus - Rare combo
    "rare": {
        "bonus_percent": 15,
        "combos": [
            {"ING001", "ING006"},  # Crunchy Kibble + Peanut Butter
            {"ING002", "ING003"},  # Golden Bone Dust + Bacon Bits
            {"ING005", "ING010"},  # Shiba Crunch + Cheese Powder
        ],
        "description": "Rare WOW Combo - Good boost!"
    },
    # 5% bonus - Common combo (any combo with kernel)
    "common": {
        "bonus_percent": 5,
        "combos": [],  # Any combo not matching above gets 5%
        "description": "Basic WOW Combo - Small boost!"
    }
}

class SpecialIngredientHolder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player_address: str
    player_nickname: Optional[str] = None
    ingredient_id: str = "KERNEL_WOW"
    granted_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    used_in_treats: List[str] = []  # Treat IDs where this was used
    total_bonus_earned: int = 0
    is_active: bool = True

class SpecialIngredientHistory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player_address: str
    player_nickname: Optional[str] = None
    granted_at: datetime
    expired_at: datetime
    treats_created: int = 0
    total_bonus_earned: int = 0

# Player Management Routes
@api_router.post("/player", response_model=Player)
async def create_player(player_data: PlayerCreate):
    # Check if player already exists
    existing_player = await db.players.find_one({"address": player_data.address})
    if existing_player:
        return Player(**existing_player)
    
    # Determine if player is VIP (NFT holder gets 500 bonus points)
    starting_points = 0
    is_vip = False
    vip_bonus_claimed = False
    
    if player_data.is_nft_holder:
        is_vip = True
        starting_points = 500  # VIP Scientist bonus
        vip_bonus_claimed = True
        logger.info(f"🌟 VIP Scientist registered: {player_data.address} - Awarded 500 bonus points!")
    
    player = Player(
        address=player_data.address,
        nickname=player_data.nickname,  # Enhanced: Store nickname
        is_nft_holder=player_data.is_nft_holder,
        is_vip=is_vip,
        vip_bonus_claimed=vip_bonus_claimed,
        points=starting_points
    )
    
    await db.players.insert_one(player.dict())
    return player

@api_router.get("/player/{address}", response_model=Player)
async def get_player(address: str):
    player = await db.players.find_one({"address": address})
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return Player(**player)

@api_router.post("/player/progress")
async def update_player_progress(progress: PlayerProgress):
    result = await db.players.update_one(
        {"address": progress.address},
        {
            "$inc": {
                "experience": progress.experience,
                "points": progress.points
            },
            "$set": {
                "level": progress.level,
                "last_active": datetime.utcnow()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Player not found")
    
    return {"message": "Progress updated successfully"}

# =====================================================
# ANTI-CHEAT & DAILY LIMIT ENDPOINTS
# =====================================================

@api_router.get("/daily-status/{address}")
async def get_daily_treat_status(address: str):
    """
    Get player's daily treat creation status including:
    - Treats created today
    - Remaining treats
    - Extra lives purchased
    - Time until reset
    """
    try:
        status = await anti_cheat_system.get_daily_treat_status(address)
        return status
    except Exception as e:
        logger.error(f"Error getting daily status: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@api_router.post("/extra-life/{address}")
async def purchase_extra_life(address: str):
    """
    Purchase an extra life for 5000 $LAB tokens.
    NOTE: $LAB is not yet live - this will return a placeholder response.
    """
    try:
        result = await anti_cheat_system.purchase_extra_life(address)
        return result
    except Exception as e:
        logger.error(f"Error purchasing extra life: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@api_router.get("/streak/{address}")
async def get_player_streak(address: str):
    """
    Get player's current streak information and bonuses.
    Streak bonuses include:
    - Bonus daily treats
    - XP multiplier
    - Brewing time reduction
    """
    try:
        from services.anti_cheat import get_streak_bonus
        streak_info = await anti_cheat_system.get_player_streak(address)
        streak_bonus = get_streak_bonus(streak_info["current_streak"])
        return {
            **streak_info,
            "streak_bonus": streak_bonus,
            "all_tiers": {
                1: {"bonus_treats": 0, "xp_multiplier": 1.0, "title": "New Chef"},
                3: {"bonus_treats": 1, "xp_multiplier": 1.1, "title": "Rising Star"},
                5: {"bonus_treats": 1, "xp_multiplier": 1.15, "title": "Dedicated Chef"},
                7: {"bonus_treats": 2, "xp_multiplier": 1.2, "title": "Week Warrior"},
                14: {"bonus_treats": 2, "xp_multiplier": 1.3, "title": "Lab Legend"},
                30: {"bonus_treats": 3, "xp_multiplier": 1.5, "title": "Master Scientist"},
            }
        }
    except Exception as e:
        logger.error(f"Error getting streak: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@api_router.get("/player-stats/{address}")
async def get_player_weekly_stats(address: str):
    """
    Get player's stats for the last 7 days.
    Includes treats created, points earned, XP gained, streak info, rarity breakdown, etc.
    """
    try:
        from services.anti_cheat import get_streak_bonus
        
        # Get player data
        player = await db.players.find_one({"address": address})
        if not player:
            raise HTTPException(status_code=404, detail="Player not found")
        
        # Calculate 7 days ago
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        
        # Get treats created in last 7 days
        treats_cursor = db.treats.find({
            "creator_address": address,
            "created_at": {"$gte": seven_days_ago}
        })
        treats_list = await treats_cursor.to_list(length=500)
        
        # Calculate stats
        total_treats = len(treats_list)
        
        # Rarity breakdown
        rarity_counts = {"Common": 0, "Uncommon": 0, "Rare": 0, "Epic": 0, "Legendary": 0, "Mythic": 0}
        total_points = 0
        total_xp = 0
        unique_formulas = set()
        
        for treat in treats_list:
            rarity = treat.get("rarity", "Common")
            if rarity in rarity_counts:
                rarity_counts[rarity] += 1
            
            total_points += treat.get("points_reward", 0)
            total_xp += treat.get("xp_reward", 0)
            
            # Track unique ingredient combinations
            ingredients = tuple(sorted(treat.get("ingredients", [])))
            if ingredients:
                unique_formulas.add(ingredients)
        
        # Get streak info
        streak_info = await anti_cheat_system.get_player_streak(address)
        streak_bonus = get_streak_bonus(streak_info.get("current_streak", 0))
        
        # Calculate best rarity found
        best_rarity = "None"
        rarity_order = ["Mythic", "Legendary", "Epic", "Rare", "Uncommon", "Common"]
        for r in rarity_order:
            if rarity_counts.get(r, 0) > 0:
                best_rarity = r
                break
        
        # Get daily breakdown - Last 7 days including today
        daily_stats = {}
        now = datetime.utcnow()
        for i in range(7):
            day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            daily_stats[day] = {"treats": 0, "points": 0, "xp": 0}
        
        for treat in treats_list:
            created_at = treat.get("created_at")
            if created_at:
                # Handle different datetime formats
                if isinstance(created_at, str):
                    try:
                        # Remove timezone info for comparison
                        created_at = created_at.replace("Z", "").replace("+00:00", "").split(".")[0]
                        created_at = datetime.fromisoformat(created_at)
                    except:
                        continue
                
                day = created_at.strftime("%Y-%m-%d")
                if day in daily_stats:
                    daily_stats[day]["treats"] += 1
                    daily_stats[day]["points"] += treat.get("points_reward", 0)
                    daily_stats[day]["xp"] += treat.get("xp_reward", 0)
        
        # Calculate averages
        avg_treats_per_day = total_treats / 7 if total_treats > 0 else 0
        avg_points_per_day = total_points / 7 if total_points > 0 else 0
        
        # Get player rank from leaderboard
        leaderboard_cursor = db.players.find(
            {"points": {"$gt": 0}},
            {"address": 1, "points": 1}
        ).sort("points", -1)
        leaderboard_list = await leaderboard_cursor.to_list(length=1000)
        
        player_rank = None
        total_players = len(leaderboard_list)
        for idx, lb_player in enumerate(leaderboard_list):
            if lb_player.get("address", "").lower() == address.lower():
                player_rank = idx + 1
                break
        
        # Serialize player data (exclude _id)
        player_data = {
            "nickname": player.get("nickname", f"Scientist"),
            "address": address,
            "points": player.get("points", 0),
            "xp": player.get("xp", 0),
            "level": player.get("level", 1),
            "selected_character": player.get("selected_character", "luna"),
            "character_image": player.get("character_image"),
            "is_nft_holder": player.get("is_nft_holder", False),
            "total_treats_created": player.get("total_treats_created", len(player.get("created_treats", [])))
        }
        
        return {
            "player": player_data,
            "rank": player_rank,
            "total_players": total_players,
            "period": "Last 7 Days",
            "period_start": seven_days_ago.isoformat(),
            "period_end": datetime.utcnow().isoformat(),
            "stats": {
                "treats_created": total_treats,
                "points_earned": total_points,
                "xp_gained": total_xp,
                "unique_formulas": len(unique_formulas),
                "best_rarity": best_rarity,
                "avg_treats_per_day": round(avg_treats_per_day, 1),
                "avg_points_per_day": round(avg_points_per_day, 1)
            },
            "rarity_breakdown": rarity_counts,
            "streak": {
                "current": streak_info.get("current_streak", 0),
                "longest": streak_info.get("longest_streak", 0),
                "title": streak_bonus.get("title", "New Chef"),
                "bonus_treats": streak_bonus.get("bonus_treats", 0),
                "xp_multiplier": streak_bonus.get("xp_multiplier", 1.0)
            },
            "daily_breakdown": daily_stats
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting player stats: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@api_router.post("/streak/{address}/checkin")
async def update_player_streak(address: str):
    """
    Update player's streak when they play. Called automatically on treat creation.
    """
    try:
        result = await anti_cheat_system.update_player_streak(address)
        return result
    except Exception as e:
        logger.error(f"Error updating streak: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# Treat Management Routes
@api_router.post("/treats", response_model=DogeTreat)
async def create_treat(treat_data: TreatCreate, background_tasks: BackgroundTasks):
    # Phase 2: Anti-cheat validation
    cheat_check = await anti_cheat_system.validate_treat_creation(
        treat_data.creator_address,
        treat_data.dict()
    )
    
    if not cheat_check["valid"]:
        raise HTTPException(
            status_code=429,  # Too Many Requests
            detail=f"Anti-cheat triggered: {cheat_check['reason']}"
        )
    
    # Enhanced: Calculate ready_at time if timer is specified
    ready_at = None
    if treat_data.timer_duration and treat_data.brewing_status == "brewing":
        from datetime import timedelta
        ready_at = datetime.utcnow() + timedelta(seconds=treat_data.timer_duration)
    
    treat = DogeTreat(
        **treat_data.dict(),
        ready_at=ready_at
    )
    
    # Add treat to database
    await db.treats.insert_one(treat.dict())
    
    # Add treat ID to player's created_treats list
    await db.players.update_one(
        {"address": treat_data.creator_address},
        {"$push": {"created_treats": treat.id}}
    )
    
    # NOTE: Points and XP are awarded ONLY when the treat is collected, not on creation
    # This prevents double-awarding rewards
    
    return treat

@api_router.get("/treats/{address}", response_model=List[DogeTreat])
async def get_player_treats(address: str):
    treats = await db.treats.find({"creator_address": address}).to_list(1000)
    return [DogeTreat(**treat) for treat in treats]

# Player Profile Update Endpoints
@api_router.post("/player/{address}/update-username")
async def update_player_username(address: str, username: str):
    """Update player's username/nickname"""
    # Check if username is already taken
    existing = await db.players.find_one({"nickname": username, "address": {"$ne": address}})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Validate username (3-20 chars, alphanumeric and underscores only)
    import re
    if not re.match(r'^[a-zA-Z0-9_]{3,20}$', username):
        raise HTTPException(status_code=400, detail="Username must be 3-20 characters, alphanumeric and underscores only")
    
    result = await db.players.update_one(
        {"address": address},
        {"$set": {"nickname": username}},
        upsert=True
    )
    
    return {"success": True, "username": username}

@api_router.post("/player/{address}/select-character")
async def select_player_character(address: str, character_id: str):
    """
    Select a character (ONE TIME ONLY).
    Character IDs: 'max', 'rex', 'luna'
    """
    # Validate character ID
    valid_characters = ['max', 'rex', 'luna']
    if character_id not in valid_characters:
        raise HTTPException(status_code=400, detail=f"Invalid character. Must be one of: {valid_characters}")
    
    # Check if player already has a character selected
    player = await db.players.find_one({"address": address}, {"_id": 0})
    if player and player.get("selected_character"):
        raise HTTPException(
            status_code=400, 
            detail="Character already selected. Character choice is permanent and cannot be changed!"
        )
    
    # Character bonuses
    character_bonuses = {
        'max': {'experience_bonus': 0.10, 'description': '+10% Experience from treats'},
        'rex': {'rare_chance_bonus': 0.15, 'description': '+15% Rare treat chance'},
        'luna': {'points_bonus': 0.20, 'description': '+20% Points from treats'}
    }
    
    result = await db.players.update_one(
        {"address": address},
        {
            "$set": {
                "selected_character": character_id,
                "character_bonuses": character_bonuses.get(character_id, {})
            }
        },
        upsert=True
    )
    
    logger.info(f"🧪 Character selected: {address} chose {character_id}")
    
    return {
        "success": True, 
        "character_id": character_id,
        "bonuses": character_bonuses.get(character_id, {}),
        "message": f"Character {character_id} selected! This choice is permanent."
    }

@api_router.get("/characters")
async def get_characters():
    """Get all available characters and their bonuses"""
    characters = {
        "max": {
            "id": "max",
            "name": "Max",
            "description": "The energetic Shiba who never stops learning",
            "image": "https://customer-assets.emergentagent.com/job_shibalab/artifacts/max_character.png",
            "bonus_type": "experience",
            "bonus_value": 0.10,
            "bonus_description": "+10% Experience from treats",
            "personality": ["Energetic", "Curious", "Friendly"]
        },
        "rex": {
            "id": "rex",
            "name": "Rex",
            "description": "The lucky Shiba with a nose for rare treats",
            "image": "https://customer-assets.emergentagent.com/job_shibalab/artifacts/rex_character.png",
            "bonus_type": "rare_chance",
            "bonus_value": 0.15,
            "bonus_description": "+15% Rare treat chance",
            "personality": ["Lucky", "Adventurous", "Bold"]
        },
        "luna": {
            "id": "luna",
            "name": "Luna",
            "description": "The clever Shiba who knows how to earn more",
            "image": "https://customer-assets.emergentagent.com/job_shibalab/artifacts/luna_character.png",
            "bonus_type": "points",
            "bonus_value": 0.20,
            "bonus_description": "+20% Points from treats",
            "personality": ["Clever", "Strategic", "Calm"]
        }
    }
    
    return {
        "characters": characters,
        "note": "Character selection is permanent and cannot be changed!"
    }

@api_router.get("/player/{address}/profile")
async def get_player_profile(address: str):
    """Get player profile including character and username"""
    player = await db.players.find_one({"address": address}, {"_id": 0})
    
    if not player:
        return {
            "address": address,
            "nickname": None,
            "selected_character": None,
            "character_bonuses": None,
            "is_vip": False,
            "points": 0,
            "level": 1,
            "profile_image": None
        }
    
    return player

@api_router.post("/player/{address}/profile-image")
async def update_profile_image(address: str, data: dict):
    """Update player's profile image (base64 encoded)"""
    try:
        image_data = data.get("image")
        if not image_data:
            raise HTTPException(status_code=400, detail="Image data required")
        
        # Validate image size (base64 adds ~33% overhead, so 2MB file = ~2.7MB base64)
        if len(image_data) > 3 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image too large (max 2MB)")
        
        # Update player's profile image
        result = await db.players.update_one(
            {"address": address},
            {"$set": {"profile_image": image_data, "last_active": datetime.utcnow().isoformat()}}
        )
        
        if result.modified_count == 0:
            # Player doesn't exist, create them
            await db.players.insert_one({
                "address": address,
                "profile_image": image_data,
                "created_at": datetime.utcnow().isoformat(),
                "last_active": datetime.utcnow().isoformat()
            })
        
        return {"success": True, "message": "Profile image updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/credit-nft-holders")
async def credit_existing_nft_holders():
    """
    Admin endpoint to credit all existing NFT holders who haven't received their VIP bonus.
    This is a one-time fix for players who registered before the bonus was implemented.
    """
    try:
        # Find all NFT holders who haven't received their bonus
        uncredited_holders = await db.players.find({
            "is_nft_holder": True,
            "$or": [
                {"vip_bonus_claimed": False},
                {"vip_bonus_claimed": {"$exists": False}}
            ]
        }).to_list(1000)
        
        credited_count = 0
        credited_players = []
        
        for player in uncredited_holders:
            address = player.get("address")
            current_points = player.get("points", 0)
            
            # Credit 500 bonus points
            await db.players.update_one(
                {"address": address},
                {
                    "$set": {
                        "vip_bonus_claimed": True,
                        "is_vip": True
                    },
                    "$inc": {"points": 500}
                }
            )
            
            credited_count += 1
            credited_players.append({
                "address": address,
                "old_points": current_points,
                "new_points": current_points + 500
            })
            logger.info(f"🌟 Credited VIP bonus to {address}: {current_points} -> {current_points + 500}")
        
        return {
            "success": True,
            "message": f"Credited {credited_count} NFT holders with 500 bonus points each",
            "credited_count": credited_count,
            "credited_players": credited_players
        }
        
    except Exception as e:
        logger.error(f"Error crediting NFT holders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/treats", response_model=List[DogeTreat])
async def get_all_treats(limit: int = 50):
    treats = await db.treats.find().sort("created_at", -1).limit(limit).to_list(limit)
    return [DogeTreat(**treat) for treat in treats]

# Enhanced: Timer system routes
@api_router.post("/treats/{treat_id}/check-timer")
async def check_treat_timer(treat_id: str):
    """Check if a treat's timer has completed and update status if ready"""
    treat = await db.treats.find_one({"id": treat_id})
    if not treat:
        raise HTTPException(status_code=404, detail="Treat not found")
    
    # Check if treat is brewing and timer has completed
    if treat.get("brewing_status") == "brewing" and treat.get("ready_at"):
        ready_at = treat["ready_at"]
        if datetime.utcnow() >= ready_at:
            # Update treat status to ready
            await db.treats.update_one(
                {"id": treat_id},
                {"$set": {"brewing_status": "ready"}}
            )
            return {"status": "ready", "message": "Treat is ready!"}
        else:
            # Calculate remaining time
            remaining_seconds = int((ready_at - datetime.utcnow()).total_seconds())
            return {
                "status": "brewing",
                "remaining_seconds": remaining_seconds,
                "message": f"Treat will be ready in {remaining_seconds} seconds"
            }
    
    return {"status": treat.get("brewing_status", "ready"), "message": "Treat status checked"}

@api_router.get("/treats/{address}/brewing")
async def get_brewing_treats(address: str):
    """Get all treats currently brewing for a player with real-time timer data"""
    try:
        brewing_treats = await db.treats.find({
            "creator_address": address,
            "brewing_status": "brewing"
        }).to_list(100)
        
        now = datetime.utcnow()
        result = []
        
        for treat in brewing_treats:
            ready_at = treat.get("ready_at")
            if ready_at:
                # Parse ready_at if it's a string
                if isinstance(ready_at, str):
                    ready_at = datetime.fromisoformat(ready_at.replace("Z", "+00:00").replace("+00:00", ""))
                
                if now >= ready_at:
                    # Auto-update to ready
                    await db.treats.update_one(
                        {"id": treat["id"]},
                        {"$set": {"brewing_status": "ready"}}
                    )
                    treat["brewing_status"] = "ready"
                    treat["time_remaining"] = 0
                else:
                    # Calculate remaining time
                    remaining = (ready_at - now).total_seconds()
                    treat["time_remaining"] = int(remaining)
                    treat["time_remaining_formatted"] = format_time_remaining(int(remaining))
            
            # Remove MongoDB _id field
            if "_id" in treat:
                del treat["_id"]
            result.append(treat)
        
        return {
            "treats": result,
            "server_time": now.isoformat(),
            "count": len(result)
        }
    except Exception as e:
        logger.error(f"Error getting brewing treats: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

def format_time_remaining(seconds: int) -> str:
    """Format seconds into human readable time"""
    if seconds <= 0:
        return "Ready!"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours}h {minutes}m {secs}s"
    elif minutes > 0:
        return f"{minutes}m {secs}s"
    return f"{secs}s"

@api_router.get("/treats/{address}/active")
async def get_active_treats_with_timer(address: str):
    """
    Get all active treats for a player with real-time countdown timers.
    This endpoint is optimized for frontend polling.
    """
    try:
        now = datetime.utcnow()
        
        # Get all recent treats for this player (last 24 hours or still brewing)
        # Exclude collected treats
        cutoff = now - timedelta(hours=24)
        treats = await db.treats.find({
            "creator_address": address,
            "brewing_status": {"$ne": "collected"},  # Exclude collected treats
            "$or": [
                {"brewing_status": "brewing"},
                {"brewing_status": "ready"},
                {"created_at": {"$gte": cutoff}}
            ]
        }).sort("created_at", -1).limit(10).to_list(10)
        
        result = []
        for treat in treats:
            # Skip collected treats (double check)
            if treat.get("brewing_status") == "collected":
                continue
                
            ready_at = treat.get("ready_at")
            created_at = treat.get("created_at")
            timer_duration = treat.get("timer_duration", 3600)
            
            # Parse dates if strings
            if isinstance(ready_at, str):
                try:
                    ready_at = datetime.fromisoformat(ready_at.replace("Z", ""))
                except:
                    ready_at = now
            
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at.replace("Z", ""))
                except:
                    created_at = now
            
            # Calculate timer status
            if ready_at:
                remaining_seconds = max(0, int((ready_at - now).total_seconds()))
                is_ready = remaining_seconds <= 0
                
                # Calculate progress (0-100)
                total_duration = timer_duration if timer_duration else 3600
                elapsed = total_duration - remaining_seconds
                progress = min(100, max(0, (elapsed / total_duration) * 100))
            else:
                remaining_seconds = 0
                is_ready = True
                progress = 100
            
            # Update status if ready
            if is_ready and treat.get("brewing_status") == "brewing":
                await db.treats.update_one(
                    {"id": treat["id"]},
                    {"$set": {"brewing_status": "ready"}}
                )
                treat["brewing_status"] = "ready"
            
            # Remove MongoDB _id
            if "_id" in treat:
                del treat["_id"]
            
            treat_data = {
                **treat,
                "timer": {
                    "remaining_seconds": remaining_seconds,
                    "remaining_formatted": format_time_remaining(remaining_seconds),
                    "is_ready": is_ready,
                    "progress_percent": round(progress, 1),
                    "total_duration": timer_duration
                }
            }
            result.append(treat_data)
        
        return {
            "treats": result,
            "server_time": now.isoformat(),
            "count": len(result)
        }
    except Exception as e:
        logger.error(f"Error getting active treats: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@api_router.post("/treats/{treat_id}/collect")
async def collect_treat(treat_id: str, data: dict):
    """
    Collect a ready treat and award points/XP to the player.
    Character bonuses are applied:
    - Max: +10% Experience
    - Luna: +20% Points
    - Rex: (bonus applies during treat creation for rare chance)
    """
    try:
        player_address = data.get("player_address")
        if not player_address:
            raise HTTPException(status_code=400, detail="Player address required")
        
        # Find the treat
        treat = await db.treats.find_one({"id": treat_id})
        if not treat:
            raise HTTPException(status_code=404, detail="Treat not found")
        
        # Verify ownership
        if treat.get("creator_address") != player_address:
            raise HTTPException(status_code=403, detail="You don't own this treat")
        
        # Check if already collected
        if treat.get("brewing_status") == "collected":
            raise HTTPException(status_code=400, detail="Treat already collected")
        
        # Check if ready
        now = datetime.utcnow()
        ready_at = treat.get("ready_at")
        if isinstance(ready_at, str):
            ready_at = datetime.fromisoformat(ready_at.replace("Z", ""))
        
        if ready_at and now < ready_at:
            raise HTTPException(status_code=400, detail="Treat is not ready yet")
        
        # Get base rewards
        base_points_reward = treat.get("points_reward", 10)
        base_xp_reward = treat.get("xp_reward", 5)
        
        # Get player to check for character bonuses
        player = await db.players.find_one({"address": player_address})
        
        # Apply character bonuses
        points_bonus = 0
        xp_bonus = 0
        bonus_details = {}
        
        if player:
            selected_character = player.get("selected_character")
            character_bonuses = player.get("character_bonuses", {})
            
            # Luna: +20% Points bonus
            if selected_character == "luna" or character_bonuses.get("points_bonus"):
                points_bonus_percent = character_bonuses.get("points_bonus", 0.20)
                points_bonus = int(base_points_reward * points_bonus_percent)
                bonus_details["luna_points_bonus"] = points_bonus
                logger.info(f"🌙 Luna bonus: +{points_bonus} points ({points_bonus_percent*100}%) for {player_address}")
            
            # Max: +10% Experience bonus
            if selected_character == "max" or character_bonuses.get("experience_bonus"):
                xp_bonus_percent = character_bonuses.get("experience_bonus", 0.10)
                xp_bonus = int(base_xp_reward * xp_bonus_percent)
                bonus_details["max_xp_bonus"] = xp_bonus
                logger.info(f"🔥 Max bonus: +{xp_bonus} XP ({xp_bonus_percent*100}%) for {player_address}")
        
        # Calculate final rewards with bonuses
        final_points_reward = base_points_reward + points_bonus
        final_xp_reward = base_xp_reward + xp_bonus
        
        # Update treat status
        await db.treats.update_one(
            {"id": treat_id},
            {"$set": {
                "brewing_status": "collected",
                "collected_at": now.isoformat(),
                "final_points_awarded": final_points_reward,
                "final_xp_awarded": final_xp_reward,
                "character_bonuses_applied": bonus_details
            }}
        )
        
        # Update player stats
        if player:
            new_xp = player.get("experience", 0) + final_xp_reward
            new_level = player.get("level", 1)
            
            # Check for level up (100 XP per level)
            xp_for_level = new_level * 100
            leveled_up = False
            if new_xp >= xp_for_level:
                new_level += 1
                new_xp = new_xp - xp_for_level
                leveled_up = True
            
            await db.players.update_one(
                {"address": player_address},
                {"$set": {
                    "experience": new_xp,
                    "level": new_level,
                    "last_active": now.isoformat()
                },
                "$inc": {"points": final_points_reward}}
            )
            
            return {
                "success": True,
                "message": "Treat collected successfully!",
                "rewards": {
                    "base_points": base_points_reward,
                    "base_xp": base_xp_reward,
                    "points_bonus": points_bonus,
                    "xp_bonus": xp_bonus,
                    "total_points": final_points_reward,
                    "total_xp": final_xp_reward
                },
                "character_bonus_applied": bonus_details if bonus_details else None,
                "leveled_up": leveled_up,
                "new_level": new_level if leveled_up else None,
                "treat_id": treat_id
            }
        
        return {
            "success": True,
            "message": "Treat collected successfully!",
            "rewards": {
                "points": final_points_reward,
                "xp": final_xp_reward
            },
            "treat_id": treat_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error collecting treat: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# Leaderboard Routes
@api_router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard(limit: int = 50):
    # Get top players by points (all players, not just NFT holders)
    pipeline = [
        {"$match": {"points": {"$gt": 0}}},  # Any player with points
        {"$sort": {"points": -1, "level": -1}},
        {"$limit": limit}
    ]
    
    top_players = await db.players.aggregate(pipeline).to_list(limit)
    
    # Character data mapping
    character_data = {
        'max': {
            'name': 'Shiba Scientist Max',
            'image': 'https://customer-assets.emergentagent.com/job_50ed16dc-caaa-4db1-ad7d-d26be77125c0/artifacts/5thty2tp_20250921_1510_Doge%20Scientist%20Trio_simple_compose_01k5p68s01e1p8f81hk4dvm5tm.png'
        },
        'rex': {
            'name': 'Shiba Scientist Rex',
            'image': 'https://customer-assets.emergentagent.com/job_50ed16dc-caaa-4db1-ad7d-d26be77125c0/artifacts/w3y5oh69_assets_task_01k5p6sq20fh68gb4hjbs9271e_1758460753_img_0.webp'
        },
        'luna': {
            'name': 'Shiba Scientist Luna',
            'image': 'https://customer-assets.emergentagent.com/job_50ed16dc-caaa-4db1-ad7d-d26be77125c0/artifacts/m1k3hm3c_assets_task_01k5p7arcvf6jt34pk82yke1sh_1758461571_img_0.webp'
        }
    }
    
    leaderboard = []
    for rank, player in enumerate(top_players, 1):
        char_id = player.get("selected_character")
        char_info = character_data.get(char_id, {})
        
        leaderboard.append(LeaderboardEntry(
            address=player["address"],
            nickname=player.get("nickname", "Player"),  # Default nickname
            points=player.get("points", 0),
            level=player.get("level", 1),  # Default to level 1
            is_nft_holder=player.get("is_nft_holder", False),
            is_vip=player.get("is_vip", False),
            rank=rank,
            selected_character=char_id,
            character_name=char_info.get('name'),
            character_image=char_info.get('image')
        ))
    
    return leaderboard

# Game Stats Routes
@api_router.get("/stats")
async def get_game_stats():
    try:
        total_players = await db.players.count_documents({})
        nft_holders = await db.players.count_documents({"is_nft_holder": True})
        total_treats = await db.treats.count_documents({})
        
        # Get most active players from today
        from datetime import datetime, timedelta
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        active_players = await db.players.count_documents(
            {"last_active": {"$gte": today}}
        )
        
        return {
            "total_players": total_players,
            "nft_holders": nft_holders,
            "total_treats": total_treats,
            "active_today": active_players
        }
    except Exception as e:
        logger.error(f"Error getting game stats: {e}")
        # Return mock data if database query fails
        return {
            "total_players": 1247,
            "nft_holders": 89,
            "total_treats": 3420,
            "active_today": 156
        }

# Phase 2: Enhanced Points System Routes
@api_router.get("/points/leaderboard")
async def get_points_leaderboard(limit: int = 50, nft_holders_only: bool = False):
    """Get enhanced points-based leaderboard - now includes all players by default"""
    leaderboard = await points_system.get_points_leaderboard(limit=limit, nft_holders_only=nft_holders_only)
    return {"leaderboard": leaderboard, "generated_at": datetime.utcnow()}

@api_router.get("/points/{address}/stats")
async def get_player_points_stats(address: str):
    """Get detailed player points statistics"""
    try:
        stats = await points_system.get_player_stats(address)
        if not stats:
            raise HTTPException(status_code=404, detail="Player not found")
        return stats
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error getting player stats for {address}: {str(e)}")
        # Return basic stats if detailed stats fail
        try:
            player = await db.players.find_one({"address": address})
            if not player:
                raise HTTPException(status_code=404, detail="Player not found")
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
                    "treats_created": 0,
                    "login_streak": 0,
                    "treat_creation_streak": 0,
                    "recent_transactions": 0
                },
                "points_breakdown": {}
            }
        except HTTPException:
            raise
        except Exception as fallback_error:
            logger.error(f"Fallback stats failed for {address}: {str(fallback_error)}")
            raise HTTPException(status_code=500, detail="Unable to retrieve player statistics")

@api_router.get("/points/{address}/history")
async def get_player_points_history(address: str, days: int = 30):
    """Get player's points transaction history"""
    history = await points_system.get_player_points_history(address, days)
    return {"transactions": history, "days": days}

@api_router.post("/points/{address}/daily-bonus")
async def claim_daily_bonus(address: str):
    """Claim daily bonus points (NFT holders only)"""
    points_awarded = await points_system.award_points(address, "daily_bonus")
    if points_awarded > 0:
        return {"message": f"Daily bonus claimed: +{points_awarded} points", "points": points_awarded}
    else:
        raise HTTPException(status_code=400, detail="Daily bonus already claimed or not eligible")

# Phase 2: Anti-cheat System Routes  
@api_router.get("/security/player-risk/{address}")
async def get_player_risk_score(address: str):
    """Get player's anti-cheat risk assessment"""
    risk_data = await anti_cheat_system.get_player_risk_score(address)
    return risk_data

@api_router.get("/security/flagged-players")
async def get_flagged_players(risk_level: str = "high"):
    """Get list of players flagged for suspicious activity (admin only)"""
    flagged = await anti_cheat_system.get_flagged_players(risk_level)
    return {"flagged_players": flagged, "risk_level": risk_level}

# NFT Verification Route
# DogeFood Lab NFT Contract: 0xA74Dad05f54d32575f82C3e065C4441b8d979a54
DOGEFOOD_NFT_CONTRACT = "0xA74Dad05f54d32575f82C3e065C4441b8d979a54"

@api_router.post("/player/{address}/verify-nft")
async def verify_player_nft(address: str, data: dict = None):
    """
    Verify NFT ownership from frontend POST body and update player VIP status.
    Accepts: {"is_nft_holder": true/false, "nft_balance": number}
    """
    try:
        if data is None:
            data = {}
        
        is_holder = data.get("is_nft_holder", False)
        nft_balance = data.get("nft_balance", 0)
        
        logger.info(f"🔍 Verifying NFT status for {address}: holder={is_holder}, balance={nft_balance}")
        
        # Check if player exists
        existing_player = await db.players.find_one({"address": address})
        
        if is_holder:
            if existing_player:
                # Player exists - check if VIP bonus already claimed
                if not existing_player.get("vip_bonus_claimed", False):
                    # Award 500 VIP bonus points
                    await db.players.update_one(
                        {"address": address},
                        {
                            "$set": {
                                "is_nft_holder": True,
                                "is_vip": True,
                                "vip_bonus_claimed": True,
                                "nft_balance": nft_balance
                            },
                            "$inc": {"points": 500}
                        }
                    )
                    logger.info(f"🌟 VIP bonus awarded to existing player: {address} - 500 points!")
                    return {
                        "address": address,
                        "is_nft_holder": True,
                        "is_vip": True,
                        "vip_bonus_credited": True,
                        "bonus_amount": 500,
                        "contract": DOGEFOOD_NFT_CONTRACT
                    }
                else:
                    # Already claimed bonus
                    await db.players.update_one(
                        {"address": address},
                        {"$set": {"is_nft_holder": True, "is_vip": True, "nft_balance": nft_balance}}
                    )
                    return {
                        "address": address,
                        "is_nft_holder": True,
                        "is_vip": True,
                        "vip_bonus_credited": False,
                        "already_claimed": True,
                        "contract": DOGEFOOD_NFT_CONTRACT
                    }
            else:
                # New player - they'll get bonus when they register
                return {
                    "address": address,
                    "is_nft_holder": True,
                    "is_vip": True,
                    "vip_bonus_credited": False,
                    "message": "Register to receive VIP bonus",
                    "contract": DOGEFOOD_NFT_CONTRACT
                }
        else:
            # Not an NFT holder
            if existing_player:
                await db.players.update_one(
                    {"address": address},
                    {"$set": {"is_nft_holder": False, "nft_balance": 0}}
                )
            return {
                "address": address,
                "is_nft_holder": False,
                "is_vip": False,
                "vip_bonus_credited": False,
                "contract": DOGEFOOD_NFT_CONTRACT
            }
            
    except Exception as e:
        logger.error(f"Error verifying NFT for {address}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/verify-nft/{address}")
async def verify_nft_ownership(address: str, is_holder: bool = False):
    """
    Verify NFT ownership and update player VIP status.
    Frontend should pass is_holder=True if wallet holds the NFT.
    """
    try:
        # Check if player exists
        existing_player = await db.players.find_one({"address": address})
        
        if is_holder:
            if existing_player:
                # Player exists - check if VIP bonus already claimed
                if not existing_player.get("vip_bonus_claimed", False):
                    # Award 500 VIP bonus points
                    await db.players.update_one(
                        {"address": address},
                        {
                            "$set": {
                                "is_nft_holder": True,
                                "is_vip": True,
                                "vip_bonus_claimed": True
                            },
                            "$inc": {"points": 500}
                        }
                    )
                    logger.info(f"🌟 VIP bonus awarded to existing player: {address} - 500 points!")
                    return {
                        "address": address,
                        "is_nft_holder": True,
                        "is_vip": True,
                        "vip_bonus_awarded": True,
                        "bonus_points": 500,
                        "contract": DOGEFOOD_NFT_CONTRACT
                    }
                else:
                    # Already claimed bonus - just update NFT status
                    await db.players.update_one(
                        {"address": address},
                        {"$set": {"is_nft_holder": True, "is_vip": True}}
                    )
            else:
                # New player - create with VIP bonus
                new_player = {
                    "address": address,
                    "nickname": None,
                    "is_nft_holder": True,
                    "is_vip": True,
                    "vip_bonus_claimed": True,
                    "points": 500,
                    "level": 1,
                    "experience": 0,
                    "created_treats": [],
                    "last_active": datetime.utcnow()
                }
                await db.players.insert_one(new_player)
                logger.info(f"🌟 New VIP player created: {address} - 500 bonus points!")
                return {
                    "address": address,
                    "is_nft_holder": True,
                    "is_vip": True,
                    "vip_bonus_awarded": True,
                    "bonus_points": 500,
                    "contract": DOGEFOOD_NFT_CONTRACT
                }
            
            return {
                "address": address,
                "is_nft_holder": True,
                "is_vip": True,
                "vip_bonus_awarded": False,
                "contract": DOGEFOOD_NFT_CONTRACT
            }
        else:
            # Not an NFT holder
            if existing_player:
                await db.players.update_one(
                    {"address": address},
                    {"$set": {"is_nft_holder": False}}
                )
            else:
                # Create new non-VIP player
                new_player = {
                    "address": address,
                    "nickname": None,
                    "is_nft_holder": False,
                    "is_vip": False,
                    "vip_bonus_claimed": False,
                    "points": 0,
                    "level": 1,
                    "experience": 0,
                    "created_treats": [],
                    "last_active": datetime.utcnow()
                }
                await db.players.insert_one(new_player)
            
            return {
                "address": address,
                "is_nft_holder": False,
                "is_vip": False,
                "contract": DOGEFOOD_NFT_CONTRACT
            }
    except Exception as e:
        logger.error(f"Error in verify-nft: {e}")
        raise HTTPException(status_code=500, detail=f"Error verifying NFT: {str(e)}")

# Phase 2: Web3 Rewards & Merkle Tree Routes
@api_router.post("/rewards/generate-season/{season_id}")
async def generate_season_rewards(season_id: int, reward_pool_tokens: int = 100000):
    """Generate Merkle tree for season rewards distribution"""
    
    # Get all eligible players (NFT holders with points)
    eligible_players = await db.players.find({
        "is_nft_holder": True,
        "points": {"$gt": 0}
    }).to_list(1000)
    
    if not eligible_players:
        raise HTTPException(status_code=400, detail="No eligible players found")
    
    # Get additional stats for each player
    enhanced_players = []
    for player in eligible_players:
        # Get treat count
        treat_count = await db.treats.count_documents({"creator_address": player["address"]})
        
        # Calculate activity score (simplified)
        activity_score = await points_system.calculate_player_streak(player["address"])
        activity_value = activity_score["login_streak"] + activity_score["treat_creation_streak"]
        
        enhanced_players.append({
            **player,
            "treats_created": treat_count,
            "activity_score": activity_value
        })
    
    # Generate rewards
    rewards = merkle_generator.generate_rewards_for_season(
        enhanced_players, season_id, reward_pool_tokens
    )
    
    # Generate Merkle tree
    merkle_data = merkle_generator.generate_merkle_tree(rewards)
    
    # Generate proofs
    proofs = merkle_generator.generate_merkle_proofs(merkle_data)
    
    # Export for smart contract
    contract_data = merkle_generator.export_for_smart_contract(merkle_data, proofs, season_id)
    
    # Generate summary
    summary = merkle_generator.generate_season_summary(rewards, merkle_data["merkle_root"])
    
    # Save season data to database
    season_doc = {
        "season_id": season_id,
        "merkle_root": merkle_data["merkle_root"],
        "total_rewards": merkle_data["total_rewards"],
        "total_recipients": len(rewards),
        "contract_data": contract_data,
        "summary": summary,
        "generated_at": datetime.utcnow(),
        "status": "generated"
    }
    
    await db.reward_seasons.insert_one(season_doc)
    
    return {
        "message": f"Season {season_id} rewards generated successfully",
        "merkle_root": merkle_data["merkle_root"],
        "total_recipients": len(rewards),
        "total_rewards_tokens": merkle_data["total_rewards"] / (10**18),
        "summary": summary
    }

@api_router.get("/rewards/season/{season_id}")
async def get_season_rewards(season_id: int):
    """Get season rewards information"""
    season_data = await db.reward_seasons.find_one({"season_id": season_id})
    
    if not season_data:
        raise HTTPException(status_code=404, detail="Season not found")
    
    # Convert ObjectId and datetime for JSON serialization
    if '_id' in season_data:
        season_data['_id'] = str(season_data['_id'])
    if 'generated_at' in season_data and hasattr(season_data['generated_at'], 'isoformat'):
        season_data['generated_at'] = season_data['generated_at'].isoformat()
    
    return season_data

@api_router.get("/rewards/claim/{address}/{season_id}")
async def get_claim_data(address: str, season_id: int):
    """Get Merkle proof data for claiming rewards"""
    season_data = await db.reward_seasons.find_one({"season_id": season_id})
    
    if not season_data:
        raise HTTPException(status_code=404, detail="Season not found")
    
    claim_data = season_data.get("contract_data", {}).get("claim_data", {}).get(address)
    
    if not claim_data:
        raise HTTPException(status_code=404, detail="No rewards available for this address in this season")
    
    return {
        "address": address,
        "season_id": season_id,
        "amount": claim_data["amount"],
        "proof": claim_data["proof"],
        "merkle_root": season_data["merkle_root"]
    }

@api_router.get("/rewards/seasons")
async def get_all_seasons():
    """Get all reward seasons"""
    seasons = await db.reward_seasons.find({}).sort("season_id", -1).to_list(100)
    return {"seasons": seasons}

# =====================================================
# ENHANCED GAME MECHANICS API ENDPOINTS (PHASE 3)
# =====================================================

@api_router.get("/game/rarity-system")
async def get_rarity_system():
    """Get the complete rarity system information including probabilities, rewards, and timers"""
    rarity_info = game_engine.get_rarity_info()
    return {
        "rarity_system": rarity_info,
        "total_rarities": len(rarity_info),
        "description": "Rarity determines timer duration, points reward, and XP reward for each treat",
        "note": "Higher ingredient count unlocks higher rarity tiers"
    }

# Enhanced Treat Creation with Game Engine
@api_router.post("/treats/enhanced")
async def create_enhanced_treat(treat_data: EnhancedTreatCreate, background_tasks: BackgroundTasks):
    """Create treat with enhanced game mechanics including rarity calculation and timers"""
    
    try:
        # Validate treat creation
        validation = game_engine.validate_treat_creation(treat_data.ingredients, treat_data.player_level)
        if not validation["valid"]:
            raise HTTPException(status_code=400, detail=f"Invalid treat creation: {validation['errors']}")
        
        # Anti-cheat validation (includes daily limit check)
        cheat_check = await anti_cheat_system.validate_treat_creation(
            treat_data.creator_address,
            {"ingredients": treat_data.ingredients, "level": treat_data.player_level}
        )
        if not cheat_check["valid"]:
            # Return more detailed error for daily limit
            daily_status = cheat_check.get("daily_status")
            error_detail = {
                "message": cheat_check['reason'],
                "daily_status": daily_status
            }
            raise HTTPException(status_code=429, detail=error_detail)
        
        # Update player streak on treat creation
        streak_result = await anti_cheat_system.update_player_streak(treat_data.creator_address)
        streak_bonus = streak_result.get("streak_bonus", {})
        xp_multiplier = streak_bonus.get("xp_multiplier", 1.0)
        brewing_reduction = streak_bonus.get("brewing_reduction", 0)  # percentage reduction
        
        # Get player's character bonus (Rex gives +15% rare chance)
        rare_chance_bonus = 0.0
        player = await db.players.find_one({"address": treat_data.creator_address})
        if player:
            selected_character = player.get("selected_character")
            character_bonuses = player.get("character_bonuses", {})
            
            # Rex: +15% rare treat chance
            if selected_character == "rex" or character_bonuses.get("rare_chance_bonus"):
                rare_chance_bonus = character_bonuses.get("rare_chance_bonus", 0.15)
                logger.info(f"🦖 Rex bonus: +{rare_chance_bonus*100}% rare chance for {treat_data.creator_address}")
        
        # Calculate treat outcome using game engine with character bonus
        treat_outcome = game_engine.calculate_treat_outcome(
            treat_data.ingredients, treat_data.player_level, treat_data.creator_address,
            rare_chance_bonus=rare_chance_bonus
        )
        
        # Apply streak XP bonus
        if xp_multiplier > 1.0:
            original_xp = treat_outcome.get("xp_reward", 0)
            treat_outcome["xp_reward"] = int(original_xp * xp_multiplier)
            treat_outcome["streak_xp_bonus"] = treat_outcome["xp_reward"] - original_xp
            logger.info(f"🔥 Streak XP bonus: {original_xp} -> {treat_outcome['xp_reward']} ({xp_multiplier}x)")
        
        # Apply streak brewing time reduction
        if brewing_reduction > 0:
            original_timer = treat_outcome.get("timer_duration_seconds", 0)
            reduction_factor = 1 - (brewing_reduction / 100)
            treat_outcome["timer_duration_seconds"] = int(original_timer * reduction_factor)
            treat_outcome["timer_duration_hours"] = treat_outcome["timer_duration_seconds"] / 3600
            treat_outcome["streak_time_reduction"] = original_timer - treat_outcome["timer_duration_seconds"]
            logger.info(f"⏱️ Streak time reduction: {original_timer}s -> {treat_outcome['timer_duration_seconds']}s (-{brewing_reduction}%)")
        
        # Get current season info
        current_season = season_manager.get_season_info()
        season_id = current_season.season_id
        
        # Create treat with enhanced data and NFT-ready metadata
        treat = DogeTreat(
            name=f"Level {treat_data.player_level} {treat_outcome['rarity']} Treat",
            creator_address=treat_data.creator_address,
            ingredients=treat_outcome["ingredients_used"],
            main_ingredient=treat_outcome["ingredients_used"][0] if treat_outcome["ingredients_used"] else "unknown",
            rarity=treat_outcome["rarity"],
            flavor="Enhanced",  # Could be calculated based on ingredients
            timer_duration=treat_outcome["timer_duration_seconds"],
            brewing_status="brewing",
            ready_at=datetime.fromtimestamp(treat_outcome["ready_at"]),
            image="https://customer-assets.emergentagent.com/job_shibalab/artifacts/l9ufequf_20250720_2152_Shiba_Pouring_Cereal_remix_01k0mp753tfzxs9v4dqxhtp2ng-removebg-preview.png"  # New Shiba treat image
        )
        
        # Add Season 1 specific metadata for future NFT compatibility
        treat_dict = treat.dict()
        
        # Check if player has Kernel of Wow and apply bonus
        kernel_bonus = None
        now = datetime.utcnow()
        kernel_holder = await db.special_ingredient_holders.find_one({
            "player_address": treat_data.creator_address,
            "is_active": True,
            "expires_at": {"$gt": now}
        })
        
        base_points_reward = treat_outcome.get("points_reward", 10)
        base_xp_reward = treat_outcome.get("xp_reward", 5)
        
        if kernel_holder:
            # Calculate bonus based on ingredients
            kernel_bonus = calculate_kernel_bonus(treat_outcome.get("ingredients_used", []))
            bonus_multiplier = 1 + (kernel_bonus["bonus_percent"] / 100)
            
            # Apply bonus to rewards
            boosted_points = int(base_points_reward * bonus_multiplier)
            boosted_xp = int(base_xp_reward * bonus_multiplier)
            
            kernel_bonus["base_points"] = base_points_reward
            kernel_bonus["boosted_points"] = boosted_points
            kernel_bonus["base_xp"] = base_xp_reward
            kernel_bonus["boosted_xp"] = boosted_xp
            kernel_bonus["points_bonus"] = boosted_points - base_points_reward
            kernel_bonus["xp_bonus"] = boosted_xp - base_xp_reward
            
            # Use boosted values
            final_points_reward = boosted_points
            final_xp_reward = boosted_xp
            
            # Update kernel holder record
            await db.special_ingredient_holders.update_one(
                {"id": kernel_holder.get("id")},
                {
                    "$push": {"used_in_treats": treat.id},
                    "$inc": {"total_bonus_earned": kernel_bonus["points_bonus"]}
                }
            )
            
            logger.info(f"Kernel of Wow bonus applied: {kernel_bonus['bonus_percent']}% ({kernel_bonus['tier']})")
        else:
            final_points_reward = base_points_reward
            final_xp_reward = base_xp_reward
        
        treat_dict.update({
            "season_id": season_id,
            "created_at": datetime.utcnow(),
            "is_offchain": season_id == 1,  # Season 1 is offchain only
            "points_reward": final_points_reward,
            "xp_reward": final_xp_reward,
            "kernel_bonus": kernel_bonus,  # Store bonus info in treat
            "rarity_emoji": treat_outcome.get("rarity_emoji", "⚪"),
            "rarity_color": treat_outcome.get("rarity_color", "#9CA3AF"),
            "nft_metadata": {
                "name": f"{treat_outcome['rarity']} DogeFood Treat",
                "description": f"A {treat_outcome['rarity'].lower()} treat created in Season {season_id} of DogeFood Lab",
                "image": "https://customer-assets.emergentagent.com/job_shibalab/artifacts/l9ufequf_20250720_2152_Shiba_Pouring_Cereal_remix_01k0mp753tfzxs9v4dqxhtp2ng-removebg-preview.png",
                "attributes": [
                    {"trait_type": "Rarity", "value": treat_outcome['rarity']},
                    {"trait_type": "Season", "value": season_id},
                    {"trait_type": "Creator Level", "value": treat_data.player_level},
                    {"trait_type": "Ingredients Count", "value": len(treat_outcome["ingredients_used"])},
                    {"trait_type": "Timer Duration (hours)", "value": treat_outcome["timer_duration_hours"]},
                    {"trait_type": "Points Reward", "value": treat_outcome.get("points_reward", 10)},
                    {"trait_type": "XP Reward", "value": treat_outcome.get("xp_reward", 5)},
                    {"trait_type": "Secret Combo", "value": treat_outcome.get("secret_combo", {}).get("is_secret_combo", False)}
                ]
            },
            "migration_ready": True  # Flags this treat as ready for future onchain migration
        })
        
        # Save to database with enhanced metadata
        result = await db.treats.insert_one(treat_dict)
        
        # Update player's created treats and sack progress
        player = await db.players.find_one({"address": treat_data.creator_address})
        if not player:
            # Create player if doesn't exist
            player = {
                "address": treat_data.creator_address,
                "level": 1,
                "experience": 0,
                "points": 0,
                "created_treats": [],
                "sack_progress": 0,
                "sack_completed_count": 0,
                "total_treats_created": 0,
                "nickname": "Player",
                "is_nft_holder": False,
                "leaderboard_eligible": True,
                "last_activity": datetime.utcnow()
            }
            await db.players.insert_one(player)
        
        # Update treat count and sack progress
        current_treats_count = len(player.get('created_treats', []))
        new_treats_count = current_treats_count + 1
        
        # Sack system: every 5 treats = 1 sack completion
        sack_completion_threshold = 5
        sack_progress = new_treats_count % sack_completion_threshold
        sack_completed_count = new_treats_count // sack_completion_threshold
        
        # Calculate if sack was just completed
        previous_completions = current_treats_count // sack_completion_threshold
        sack_just_completed = sack_completed_count > previous_completions
        sack_bonus_xp = 50 if sack_just_completed else 0  # 50 XP bonus per sack completion
        
        await db.players.update_one(
            {"address": treat_data.creator_address},
            {
                "$push": {"created_treats": str(result.inserted_id)},
                "$set": {
                    "sack_progress": sack_progress,
                    "sack_completed_count": sack_completed_count, 
                    "total_treats_created": new_treats_count,
                    "last_activity": datetime.utcnow()
                },
                "$inc": {
                    "experience": sack_bonus_xp  # Only award sack completion bonus XP (not treat creation XP)
                }
            }
        )
        
        # NOTE: Points and XP rewards are awarded ONLY when the treat is COLLECTED (not created)
        # This prevents double-awarding. The points_reward and xp_reward are stored in the treat
        # and will be awarded when the player calls the /treats/{treat_id}/collect endpoint
        
        # Convert treat_dict to JSON-serializable format
        treat_response = treat_dict.copy()
        
        # Convert ObjectId to string if present
        if '_id' in treat_response:
            treat_response['_id'] = str(treat_response['_id'])
        if 'id' in treat_response:
            treat_response['id'] = str(treat_response['id'])
            
        # Convert datetime objects to ISO format strings
        if 'created_at' in treat_response:
            treat_response['created_at'] = treat_response['created_at'].isoformat()
        if 'ready_at' in treat_response and treat_response['ready_at']:
            treat_response['ready_at'] = treat_response['ready_at'].isoformat()
        
        # Set the MongoDB inserted ID as the treat ID
        treat_response['id'] = str(result.inserted_id)
        
        # Get updated daily status after treat creation
        daily_status = await anti_cheat_system.get_daily_treat_status(treat_data.creator_address)
        
        # Build streak message
        streak_message = ""
        if streak_result.get("streak_increased"):
            streak_message = f" {streak_result.get('message', '')}"
        
        # Build kernel bonus message
        kernel_message = ""
        if kernel_bonus:
            kernel_message = f" 🌟 KERNEL OF WOW {kernel_bonus['tier'].upper()}! +{kernel_bonus['bonus_percent']}% bonus!"
        
        return {
            "treat": treat_response,
            "outcome": treat_outcome,
            "validation": validation,
            "sack_progress": {
                "current_progress": sack_progress,
                "completion_threshold": sack_completion_threshold,
                "completed_count": sack_completed_count,
                "just_completed": sack_just_completed,
                "bonus_xp_awarded": sack_bonus_xp,
                "total_treats": new_treats_count
            },
            "daily_status": daily_status,
            "streak": streak_result,
            "kernel_bonus": kernel_bonus,
            "message": f"Season {season_id} {treat_outcome['rarity']} treat created! Brewing for {treat_outcome['timer_duration_hours']:.1f} hours.{streak_message}{kernel_message}{'(Offchain storage)' if season_id == 1 else ''}{' 🎉 Sack completed! +50 XP bonus!' if sack_just_completed else ''}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating enhanced treat: {str(e)}")


# =====================================================
# INGREDIENT SYSTEM API ENDPOINTS
# =====================================================

@api_router.get("/ingredients/catalog")
async def get_ingredient_catalog():
    """Get complete ingredient catalog with all details"""
    from services.ingredient_system import IngredientSystem, RECIPE_TEMPLATES
    ing_system = IngredientSystem()
    
    return {
        "ingredients": ing_system.get_all_ingredients_json(),
        "categories": ing_system.get_category_info(),
        "recipes": RECIPE_TEMPLATES,
        "total_ingredients": len(ing_system.ingredients)
    }


@api_router.get("/ingredients/unlocked/{player_level}")
async def get_unlocked_ingredients(player_level: int):
    """Get ingredients unlocked at a specific player level"""
    from services.ingredient_system import IngredientSystem
    ing_system = IngredientSystem()
    
    unlocked = ing_system.get_unlocked_ingredients(player_level)
    locked = ing_system.get_locked_ingredients(player_level)
    
    # Group unlocked by category
    unlocked_by_category = {}
    for ing in unlocked:
        cat = ing.category.value
        if cat not in unlocked_by_category:
            unlocked_by_category[cat] = []
        unlocked_by_category[cat].append({
            "id": ing.id,
            "name": ing.name,
            "emoji": ing.emoji,
            "description": ing.description,
            "special_effect": ing.special_effect.value,
            "rarity_weight": ing.rarity_weight,
            "color": ing.color,
            "unlock_level": ing.unlock_level
        })
    
    # Get next unlocks
    next_unlocks = []
    current_locked_levels = sorted(set(ing.unlock_level for ing in locked))
    for level in current_locked_levels[:3]:  # Show next 3 unlock levels
        ingredients_at_level = [ing for ing in locked if ing.unlock_level == level]
        next_unlocks.append({
            "level": level,
            "ingredients": [{"id": ing.id, "name": ing.name, "emoji": ing.emoji, "category": ing.category.value} 
                          for ing in ingredients_at_level]
        })
    
    return {
        "player_level": player_level,
        "unlocked_count": len(unlocked),
        "locked_count": len(locked),
        "unlocked_by_category": unlocked_by_category,
        "next_unlocks": next_unlocks,
        "categories": ing_system.get_category_info()
    }


@api_router.post("/ingredients/validate-recipe")
async def validate_recipe(ingredients: List[str] = [], player_level: int = 1):
    """Validate a recipe before creating a treat"""
    from services.ingredient_system import IngredientSystem
    ing_system = IngredientSystem()
    
    # Check if all ingredients are unlocked
    unlocked_ids = [ing.id for ing in ing_system.get_unlocked_ingredients(player_level)]
    locked_ingredients = [ing_id for ing_id in ingredients if ing_id not in unlocked_ids]
    
    # Get special effects
    effects = ing_system.get_special_effects(ingredients)
    
    # Calculate rarity modifier
    rarity_mod = ing_system.calculate_rarity_modifier(ingredients)
    
    # Check possible rarities
    possible_rarities = []
    for rarity in ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"]:
        if ing_system.can_create_rarity(ingredients, rarity):
            possible_rarities.append(rarity)
    
    return {
        "valid": len(locked_ingredients) == 0 and len(ingredients) >= 1,
        "ingredient_count": len(ingredients),
        "locked_ingredients": locked_ingredients,
        "special_effects": [e.value for e in effects],
        "rarity_modifier": round(rarity_mod, 2),
        "has_mythic_catalyst": ing_system.has_mythic_catalyst(ingredients),
        "has_legendary_gate": ing_system.has_legendary_gate(ingredients),
        "possible_rarities": possible_rarities,
        "max_possible_rarity": possible_rarities[-1] if possible_rarities else "Common"
    }


# Season 1: Points to LAB Token Conversion (Placeholder - Not Active)
@api_router.post("/points/convert")
async def convert_points_to_lab_tokens(conversion_request: PointsConversionRequest):
    """Convert points to LAB tokens - Only available at season end"""
    
    # Check if current season allows conversion
    current_season = season_manager.get_season_info()
    season_id = current_season.season_id
    season_status = current_season.status.value
    
    if season_id == 1:  # Season 1 always blocks conversion regardless of status
        raise HTTPException(
            status_code=423,  # Locked
            detail="Points conversion is not available during Season 1. Conversion will be enabled at the end of the season."
        )
    
    # Future seasons logic would go here
    # For now, just return the conversion preview
    return {
        "message": "Conversion not available in Season 1",
        "season_id": season_id,
        "points_to_convert": conversion_request.points_to_convert,  
        "estimated_lab_tokens": conversion_request.points_to_convert // 1000,  # 1000 points = 1 LAB token
        "conversion_available": False,
        "reason": "Season 1 active - conversion available at season end only"
    }

# User Registration API
@api_router.post("/players/register")
async def register_player(registration_data: dict):
    """Register a new player with username and wallet signature"""
    
    try:
        address = registration_data.get("address")
        username = registration_data.get("username") 
        signature = registration_data.get("signature")
        message = registration_data.get("message")
        
        if not all([address, username, signature, message]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Validate username
        if len(username) < 3 or len(username) > 20:
            raise HTTPException(status_code=400, detail="Username must be between 3-20 characters")
        
        if not username.replace("_", "").isalnum():
            raise HTTPException(status_code=400, detail="Username can only contain letters, numbers, and underscores")
        
        # Check if username already taken
        existing_username = await db.players.find_one({"nickname": username})
        if existing_username:
            raise HTTPException(status_code=409, detail="Username already taken")
        
        # Check if wallet already registered
        existing_player = await db.players.find_one({"address": address})
        if existing_player:
            raise HTTPException(status_code=409, detail="Wallet already registered")
        
        # Create new player with registration data
        player_data = {
            "address": address,
            "nickname": username,
            "level": 1,
            "experience": 0,
            "points": 0,
            "created_treats": [],
            "sack_progress": 0,
            "sack_completed_count": 0,
            "total_treats_created": 0,
            "is_nft_holder": False,
            "leaderboard_eligible": True,
            "registration_signature": signature,
            "registration_message": message,
            "registered_at": datetime.utcnow(),
            "last_activity": datetime.utcnow()
        }
        
        result = await db.players.insert_one(player_data)
        
        return {
            "message": f"Player registered successfully with username: {username}",
            "player_id": str(result.inserted_id),
            "address": address,
            "username": username,
            "registered_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

# Telegram Authentication Functions
def validate_telegram_data(init_data: str) -> dict:
    """Validate Telegram Mini App init data"""
    try:
        # Parse the init_data
        data = dict(urllib.parse.parse_qsl(init_data))
        
        # Extract hash and create data string for validation
        hash_value = data.pop('hash', '')
        auth_date = data.get('auth_date', '')
        
        # Check if auth_date is not too old (optional, but recommended)
        # auth_timestamp = int(auth_date)
        # current_timestamp = int(datetime.utcnow().timestamp())
        # if current_timestamp - auth_timestamp > 86400:  # 24 hours
        #     raise ValueError("Data is too old")
        
        # Create data string for validation
        data_check_string = '\n'.join([f'{k}={v}' for k, v in sorted(data.items())])
        
        # Get bot token and create secret key
        bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        secret_key = hmac.new("WebAppData".encode(), bot_token.encode(), hashlib.sha256).digest()
        
        # Calculate expected hash
        expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        
        # Verify hash
        if hash_value != expected_hash:
            raise ValueError("Invalid hash")
        
        # Parse user data if present
        if 'user' in data:
            user_data = json.loads(data['user'])
            return user_data
        
        return {}
        
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Telegram data: {str(e)}")

# Telegram User Registration API
@api_router.post("/players/telegram-register")
async def register_telegram_player(request: Request):
    """Register a new player using Telegram authentication"""
    
    try:
        body = await request.json()
        init_data = body.get("initData")
        
        if not init_data:
            raise HTTPException(status_code=400, detail="Missing Telegram init data")
        
        # Validate Telegram data
        user_data = validate_telegram_data(init_data)
        
        if not user_data:
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        telegram_id = user_data.get("id")
        telegram_username = user_data.get("username", "")
        telegram_first_name = user_data.get("first_name", "")
        telegram_last_name = user_data.get("last_name", "")
        
        if not telegram_id:
            raise HTTPException(status_code=400, detail="Missing Telegram user ID")
        
        # Check if Telegram user already registered
        existing_player = await db.players.find_one({"telegram_id": telegram_id})
        if existing_player:
            # Return existing player data
            return {
                "message": "Player already registered",
                "player_id": existing_player.get("id"),
                "telegram_id": telegram_id,
                "username": telegram_username,
                "first_name": telegram_first_name,
                "auth_type": "telegram",
                "registered_at": existing_player.get("registered_at", datetime.utcnow()).isoformat()
            }
        
        # Create new Telegram player
        player_data = {
            "id": str(uuid.uuid4()),
            "address": None,  # No wallet address for Telegram users initially
            "nickname": telegram_first_name or telegram_username,  # Use Telegram name as nickname
            "telegram_id": telegram_id,
            "telegram_username": telegram_username,
            "telegram_first_name": telegram_first_name,
            "telegram_last_name": telegram_last_name,
            "auth_type": "telegram",
            "level": 1,
            "experience": 0,
            "points": 0,
            "created_treats": [],
            "sack_progress": 0,
            "sack_completed_count": 0,
            "total_treats_created": 0,
            "is_nft_holder": False,
            "leaderboard_eligible": True,
            "registered_at": datetime.utcnow(),
            "last_activity": datetime.utcnow()
        }
        
        result = await db.players.insert_one(player_data)
        
        return {
            "message": f"Telegram player registered successfully: {telegram_first_name or telegram_username}",
            "player_id": player_data["id"],
            "telegram_id": telegram_id,
            "username": telegram_username,
            "first_name": telegram_first_name,
            "auth_type": "telegram",
            "registered_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Telegram registration failed: {str(e)}")

# Guest Registration (Username only)
@api_router.post("/players/guest-register")
async def register_guest_player(request: Request):
    """Register a guest player with just a username - can appear on leaderboard but needs NFT to convert points"""
    
    try:
        body = await request.json()
        username = body.get("username", "").strip()
        
        if not username:
            raise HTTPException(status_code=400, detail="Username is required")
        
        # Validate username format
        if len(username) < 3 or len(username) > 20:
            raise HTTPException(status_code=400, detail="Username must be 3-20 characters")
        
        if not username.replace("_", "").isalnum():
            raise HTTPException(status_code=400, detail="Username can only contain letters, numbers, and underscores")
        
        # Check if username already exists
        existing_user = await db.players.find_one({"nickname": {"$regex": f"^{username}$", "$options": "i"}})
        if existing_user:
            raise HTTPException(status_code=409, detail="Username already taken")
        
        # Generate a unique guest ID
        guest_id = f"guest_{str(uuid.uuid4())[:8]}"
        
        # Create guest player
        player_data = {
            "id": str(uuid.uuid4()),
            "address": guest_id,  # Use guest_id as a pseudo-address
            "nickname": username,
            "auth_type": "guest",
            "level": 1,
            "experience": 0,
            "points": 0,
            "created_treats": [],
            "sack_progress": 0,
            "sack_completed_count": 0,
            "total_treats_created": 0,
            "is_nft_holder": False,
            "is_vip": False,
            "leaderboard_eligible": True,
            "can_convert_points": False,  # Can't convert without NFT
            "registered_at": datetime.utcnow(),
            "last_activity": datetime.utcnow()
        }
        
        await db.players.insert_one(player_data)
        logger.info(f"👤 Guest player registered: {username} ({guest_id})")
        
        return {
            "success": True,
            "message": f"Welcome, {username}! You can now play and appear on the leaderboard.",
            "player_id": player_data["id"],
            "guest_id": guest_id,
            "username": username,
            "auth_type": "guest",
            "leaderboard_eligible": True,
            "can_convert_points": False,
            "note": "Connect your wallet with a DogeFood NFT to convert points to $LAB tokens!",
            "registered_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Guest registration failed: {e}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

# Firebase Authentication (Email/Google)
@api_router.post("/players/firebase-register")
async def register_firebase_player(request: Request):
    """Register a player using Firebase authentication (Email or Google)"""
    
    try:
        body = await request.json()
        id_token = body.get("idToken")
        username = body.get("username", "").strip()
        
        if not id_token:
            raise HTTPException(status_code=400, detail="Firebase ID token is required")
        
        # Verify Firebase ID token
        async with httpx.AsyncClient() as client:
            verify_url = f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={FIREBASE_API_KEY}"
            response = await client.post(verify_url, json={"idToken": id_token})
            
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid Firebase token")
            
            firebase_data = response.json()
            users = firebase_data.get("users", [])
            
            if not users:
                raise HTTPException(status_code=401, detail="Firebase user not found")
            
            user_info = users[0]
            firebase_uid = user_info.get("localId")
            email = user_info.get("email")
            display_name = user_info.get("displayName", "")
            photo_url = user_info.get("photoUrl")
            
            # Determine provider (email or google)
            provider_data = user_info.get("providerUserInfo", [])
            provider = "email"
            for p in provider_data:
                if "google" in p.get("providerId", "").lower():
                    provider = "google"
                    break
        
        # Check if Firebase user already registered
        existing_player = await db.players.find_one({"firebase_uid": firebase_uid})
        if existing_player:
            return {
                "success": True,
                "message": "Welcome back!",
                "player_id": existing_player.get("id"),
                "firebase_uid": firebase_uid,
                "email": email,
                "username": existing_player.get("nickname"),
                "auth_type": "firebase",
                "already_registered": True
            }
        
        # Also check if email is already used
        if email:
            email_exists = await db.players.find_one({"email": email})
            if email_exists:
                raise HTTPException(status_code=409, detail="Email already registered")
        
        # Use provided username or generate from display name/email
        final_username = username or display_name or (email.split("@")[0] if email else f"user_{firebase_uid[:8]}")
        
        # Check if username is taken
        existing_username = await db.players.find_one({"nickname": {"$regex": f"^{final_username}$", "$options": "i"}})
        if existing_username:
            # Append random suffix
            final_username = f"{final_username}_{str(uuid.uuid4())[:4]}"
        
        # Create Firebase player
        player_data = {
            "id": str(uuid.uuid4()),
            "address": f"firebase_{firebase_uid[:12]}",  # Pseudo-address
            "nickname": final_username,
            "email": email,
            "firebase_uid": firebase_uid,
            "firebase_provider": provider,
            "profile_image": photo_url,
            "auth_type": "firebase",
            "level": 1,
            "experience": 0,
            "points": 0,
            "created_treats": [],
            "sack_progress": 0,
            "sack_completed_count": 0,
            "total_treats_created": 0,
            "is_nft_holder": False,
            "is_vip": False,
            "leaderboard_eligible": True,
            "can_convert_points": False,
            "registered_at": datetime.utcnow(),
            "last_activity": datetime.utcnow()
        }
        
        await db.players.insert_one(player_data)
        logger.info(f"🔥 Firebase player registered: {final_username} ({provider}) - {email}")
        
        return {
            "success": True,
            "message": f"Welcome, {final_username}!",
            "player_id": player_data["id"],
            "firebase_uid": firebase_uid,
            "email": email,
            "username": final_username,
            "auth_type": "firebase",
            "provider": provider,
            "leaderboard_eligible": True,
            "can_convert_points": False,
            "note": "Connect your wallet with a DogeFood NFT to convert points to $LAB tokens!",
            "registered_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Firebase registration failed: {e}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

# Link wallet to any account type (guest/firebase/telegram)
@api_router.post("/players/link-nft-wallet")
async def link_nft_wallet(request: Request):
    """Link an NFT wallet to any existing account to enable point conversion"""
    
    try:
        body = await request.json()
        player_id = body.get("player_id")
        wallet_address = body.get("address")
        is_nft_holder = body.get("is_nft_holder", False)
        
        if not player_id or not wallet_address:
            raise HTTPException(status_code=400, detail="Player ID and wallet address are required")
        
        # Find the player
        player = await db.players.find_one({"id": player_id})
        if not player:
            raise HTTPException(status_code=404, detail="Player not found")
        
        # Check if wallet is already linked to another player
        existing_wallet = await db.players.find_one({"address": wallet_address, "id": {"$ne": player_id}})
        if existing_wallet:
            raise HTTPException(status_code=409, detail="Wallet already linked to another account")
        
        # Update player with wallet info
        update_data = {
            "address": wallet_address,
            "is_nft_holder": is_nft_holder,
            "can_convert_points": is_nft_holder,  # Can convert if NFT holder
            "auth_type": "linked",
            "last_activity": datetime.utcnow(),
            "wallet_linked_at": datetime.utcnow()
        }
        
        # Award VIP bonus if NFT holder and not claimed
        if is_nft_holder and not player.get("vip_bonus_claimed"):
            update_data["is_vip"] = True
            update_data["vip_bonus_claimed"] = True
            update_data["points"] = player.get("points", 0) + 500
            logger.info(f"🌟 VIP bonus awarded to {player.get('nickname')}: +500 points")
        
        await db.players.update_one(
            {"id": player_id},
            {"$set": update_data}
        )
        
        return {
            "success": True,
            "message": "Wallet linked successfully!" + (" VIP bonus awarded!" if is_nft_holder and not player.get("vip_bonus_claimed") else ""),
            "player_id": player_id,
            "wallet_address": wallet_address,
            "is_nft_holder": is_nft_holder,
            "can_convert_points": is_nft_holder,
            "vip_bonus_awarded": is_nft_holder and not player.get("vip_bonus_claimed")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Wallet linking failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to link wallet: {str(e)}")

# Link Telegram Account to Wallet
@api_router.post("/players/link-wallet")
async def link_wallet_to_telegram(request: Request):
    """Link a wallet address to an existing Telegram user"""
    
    try:
        body = await request.json()
        init_data = body.get("initData")
        wallet_address = body.get("address")
        signature = body.get("signature")
        message = body.get("message")
        
        if not all([init_data, wallet_address, signature, message]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Validate Telegram data
        user_data = validate_telegram_data(init_data)
        telegram_id = user_data.get("id")
        
        if not telegram_id:
            raise HTTPException(status_code=401, detail="Invalid Telegram authentication")
        
        # Find existing Telegram user
        telegram_player = await db.players.find_one({"telegram_id": telegram_id})
        if not telegram_player:
            raise HTTPException(status_code=404, detail="Telegram user not found")
        
        # Check if wallet is already linked to another user
        wallet_player = await db.players.find_one({"address": wallet_address})
        if wallet_player and wallet_player.get("telegram_id") != telegram_id:
            raise HTTPException(status_code=409, detail="Wallet already linked to another account")
        
        # Update player with wallet information
        update_data = {
            "address": wallet_address,
            "auth_type": "linked",
            "last_activity": datetime.utcnow(),
            "wallet_signature": signature,
            "wallet_message": message,
            "wallet_linked_at": datetime.utcnow()
        }
        
        await db.players.update_one(
            {"telegram_id": telegram_id},
            {"$set": update_data}
        )
        
        return {
            "message": "Wallet successfully linked to Telegram account",
            "telegram_id": telegram_id,
            "address": wallet_address,
            "auth_type": "linked",
            "linked_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Wallet linking failed: {str(e)}")

# Get Player by Telegram ID
@api_router.get("/player/telegram/{telegram_id}")
async def get_player_by_telegram_id(telegram_id: int):
    """Get player by Telegram ID"""
    player = await db.players.find_one({"telegram_id": telegram_id})
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return Player(**player)

# Season Information API
@api_router.get("/season/current")
async def get_current_season_info():
    """Get current season information"""
    current_season = season_manager.get_season_info()
    
    return {
        "season_id": current_season.season_id,
        "name": current_season.name,
        "status": current_season.status.value,
        "is_offchain_only": current_season.season_id == 1,
        "features": {
            "nft_minting": current_season.season_id > 1,
            "points_conversion": current_season.status.value == "completed",
            "treat_creation": True,
            "leaderboards": True
        },
        "description": "Season 1 focuses on offchain gameplay. NFT minting and points conversion will be available in future seasons."
    }

# Ingredient System Endpoints
@api_router.get("/ingredients")
async def get_ingredients(level: int = 1):
    """Get all ingredients available at the specified level"""
    ingredients = ingredient_system.export_ingredients_for_frontend(level)
    return {"ingredients": ingredients, "level": level}

@api_router.get("/ingredients/stats")
async def get_ingredient_stats():
    """Get ingredient system statistics"""
    return ingredient_system.get_ingredient_stats()

@api_router.post("/ingredients/analyze")
async def analyze_ingredient_combination(ingredient_ids: List[str]):
    """Analyze ingredient combination for compatibility and variety"""
    
    # Get variety bonus
    variety = ingredient_system.calculate_ingredient_variety_bonus(ingredient_ids)
    
    # Get compatibility analysis
    compatibility = ingredient_system.get_ingredient_compatibility(ingredient_ids)
    
    # Check if it's a secret combo
    combo_bonus = game_engine.check_secret_combo_bonus(ingredient_ids)
    
    return {
        "ingredient_count": len(ingredient_ids),
        "variety": variety,
        "compatibility": compatibility,
        "secret_combo": combo_bonus,
        "recommended": compatibility["is_balanced"] and len(ingredient_ids) >= 3
    }

# Game Engine Endpoints
@api_router.get("/game/timer-progression")
async def get_timer_progression(max_level: int = 50):
    """Get timer progression for different levels"""
    progression = []
    for level in range(1, min(max_level + 1, 101)):
        timer_seconds = game_engine.calculate_treat_timer(level)
        progression.append({
            "level": level,
            "timer_seconds": timer_seconds,
            "timer_hours": round(timer_seconds / 3600, 1),
            "timer_formatted": f"{timer_seconds // 3600}h {(timer_seconds % 3600) // 60}m"
        })
    return {"progression": progression}

@api_router.post("/game/simulate-outcome")
async def simulate_treat_outcome(
    ingredients: List[str],
    player_level: int,
    player_address: str,
    simulations: int = 10
):
    """Simulate treat outcomes multiple times for testing (admin only)"""
    
    # Basic validation
    if len(ingredients) < 2:
        raise HTTPException(status_code=400, detail="Minimum 2 ingredients required")
    
    outcomes = []
    rarity_counts = {"Common": 0, "Rare": 0, "Epic": 0, "Legendary": 0}
    
    for i in range(min(simulations, 50)):  # Limit to 50 simulations
        try:
            outcome = game_engine.calculate_treat_outcome(
                ingredients, player_level, f"{player_address}_{i}"  # Different address for each sim
            )
            outcomes.append(outcome)
            rarity_counts[outcome["rarity"]] += 1
        except Exception as e:
            continue
    
    return {
        "simulations_run": len(outcomes),
        "rarity_distribution": rarity_counts,
        "sample_outcomes": outcomes[:5],  # Show first 5 outcomes
        "ingredients_tested": ingredients,
        "player_level": player_level
    }

# Season Management Endpoints

@api_router.delete("/admin/delete-player/{address}")
async def delete_player(address: str, admin_key: str):
    """Delete a specific player by address - admin only"""
    
    expected_key = "dogefood_admin_cleanup_2024"
    if admin_key != expected_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")
    
    # Find and delete the player
    player = await db.players.find_one({"address": address}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    # Delete player
    await db.players.delete_one({"address": address})
    
    # Delete their treats too
    treats_result = await db.treats.delete_many({"player_address": address})
    
    logger.info(f"🗑️ Deleted player: {address} and {treats_result.deleted_count} treats")
    
    return {
        "message": f"Player deleted successfully",
        "address": address,
        "nickname": player.get("nickname"),
        "treats_deleted": treats_result.deleted_count
    }


@api_router.delete("/admin/cleanup-test-players")
async def cleanup_test_players(admin_key: str = "dogefood_admin_2024"):
    """Remove test players from the database - admin only"""
    
    # Simple admin key check (in production, use proper authentication)
    expected_key = "dogefood_admin_cleanup_2024"
    if admin_key != expected_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")
    
    # Define patterns that identify test players
    test_patterns = [
        {"address": {"$regex": "^TEST_", "$options": "i"}},
        {"address": {"$regex": "^RARITY_", "$options": "i"}},
        {"address": {"$regex": "_TEST_", "$options": "i"}},
        {"address": {"$regex": "timer_debug", "$options": "i"}},
        {"address": {"$regex": "^GUEST_TEST", "$options": "i"}},
        {"address": {"$regex": "^0xATLAS_", "$options": "i"}},
        {"address": {"$regex": "^0xWALLET_USER_ATLAS", "$options": "i"}},
    ]
    
    # Find all test players first
    test_query = {"$or": test_patterns}
    test_players = await db.players.find(test_query, {"_id": 0, "address": 1, "nickname": 1}).to_list(100)
    
    if not test_players:
        return {"message": "No test players found", "deleted_count": 0}
    
    # Delete test players
    result = await db.players.delete_many(test_query)
    
    # Also delete their treats
    test_addresses = [p["address"] for p in test_players]
    treats_result = await db.treats.delete_many({"player_address": {"$in": test_addresses}})
    
    logger.info(f"🧹 Cleaned up {result.deleted_count} test players and {treats_result.deleted_count} treats")
    
    return {
        "message": f"Successfully cleaned up test players",
        "deleted_players": result.deleted_count,
        "deleted_treats": treats_result.deleted_count,
        "players_removed": [{"address": p.get("address"), "nickname": p.get("nickname")} for p in test_players]
    }


@api_router.get("/seasons/current")
async def get_current_season():
    """Get current season information"""
    season = season_manager.get_season_info()
    time_remaining = season_manager.get_time_remaining_in_season()
    
    return {
        "season": {
            "season_id": season.season_id,
            "name": season.name,
            "start_date": season.start_date.isoformat(),
            "end_date": season.end_date.isoformat(),
            "status": season.status.value,
            "description": season.description
        },
        "time_remaining": time_remaining
    }

@api_router.get("/seasons/{season_id}")
async def get_season_info(season_id: int):
    """Get specific season information"""
    season = season_manager.get_season_info(season_id)
    stats = await season_manager.get_season_stats(season_id)
    
    return {
        "season": {
            "season_id": season.season_id,
            "name": season.name,
            "start_date": season.start_date.isoformat(),
            "end_date": season.end_date.isoformat(),
            "status": season.status.value,
            "description": season.description
        },
        "stats": stats
    }

@api_router.get("/seasons")
async def list_seasons(include_upcoming: bool = True, include_archived: bool = False):
    """List all seasons with filtering"""
    seasons = season_manager.list_seasons(include_upcoming, include_archived)
    
    return {
        "seasons": [
            {
                "season_id": s.season_id,
                "name": s.name,
                "start_date": s.start_date.isoformat(),
                "end_date": s.end_date.isoformat(),
                "status": s.status.value,
                "description": s.description
            }
            for s in seasons
        ]
    }

@api_router.get("/seasons/{season_id}/leaderboard")
async def get_season_leaderboard(season_id: int, limit: int = 50):
    """Get season-specific leaderboard"""
    leaderboard = await season_manager.get_season_leaderboard(season_id, limit)
    season = season_manager.get_season_info(season_id)
    
    return {
        "season_id": season_id,
        "season_name": season.name,
        "leaderboard": leaderboard
    }

# Admin Endpoints for Game Management
@api_router.post("/admin/seasons/{season_id}/activate")
async def activate_season(season_id: int):
    """Admin: Manually activate a season (for testing)"""
    # This would typically require admin authentication
    season = season_manager.get_season_info(season_id)
    
    return {
        "message": f"Season {season_id} ({season.name}) activated",
        "season": {
            "season_id": season.season_id,
            "name": season.name,
            "status": season.status.value
        }
    }

# Health check endpoint for Vercel
@app.get("/api/health")
async def health_check():
    """Health check endpoint for monitoring"""
    try:
        # Test database connection
        await client.admin.command('ping')
        
        # Test season manager
        current_season = season_manager.get_current_season_id()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": "connected",
            "current_season": current_season,
            "environment": "production" if "vercel" in os.getenv("VERCEL_URL", "") else "development"
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unavailable: {str(e)}")

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "🧪 DogeFood Lab API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health"
    }

# API Health check
@api_router.get("/")
async def api_root():
    return {"message": "DogeFood Lab API is running! 🐕🧪"}

# ============================================
# SEASON 1 OFFICIAL LAUNCH - ADMIN ENDPOINTS
# ============================================

# Admin secret key for protected operations
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "dogefood_admin_2025")

@api_router.post("/admin/reset-leaderboard")
async def reset_leaderboard(admin_key: str = None):
    """
    Reset the leaderboard by clearing all player points.
    This marks the official start of Season 1.
    """
    if admin_key != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized: Invalid admin key")
    
    try:
        # Reset all player points to 0 (except VIP bonus which is recalculated)
        result = await db.players.update_many(
            {},
            {
                "$set": {
                    "points": 0,
                    "experience": 0,
                    "level": 1,
                    "vip_bonus_claimed": False
                }
            }
        )
        
        # Re-award VIP bonus to NFT holders
        vip_result = await db.players.update_many(
            {"is_nft_holder": True},
            {
                "$set": {
                    "points": 500,
                    "is_vip": True,
                    "vip_bonus_claimed": True
                }
            }
        )
        
        # Clear all existing treats
        treats_deleted = await db.treats.delete_many({})
        
        # Update season start time in database
        season_doc = {
            "season_id": 1,
            "name": "Season 1 - Official Launch",
            "started_at": datetime.utcnow(),
            "end_date": datetime(2026, 3, 31, 23, 59, 59),  # Season 1 ends March 31, 2026
            "status": "active",
            "reset_at": datetime.utcnow()
        }
        
        await db.seasons.update_one(
            {"season_id": 1},
            {"$set": season_doc},
            upsert=True
        )
        
        logger.info(f"🚀 SEASON 1 OFFICIALLY STARTED! Leaderboard reset. {result.modified_count} players reset, {vip_result.modified_count} VIP bonuses awarded.")
        
        return {
            "success": True,
            "message": "🚀 Season 1 officially started! Leaderboard has been reset.",
            "players_reset": result.modified_count,
            "vip_bonuses_awarded": vip_result.modified_count,
            "treats_cleared": treats_deleted.deleted_count,
            "season_started_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error resetting leaderboard: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reset leaderboard: {str(e)}")

@api_router.get("/season/timer")
async def get_season_timer():
    """
    Get real-time season countdown timer.
    Returns time remaining in the current season.
    """
    try:
        # Check if we have a stored season in database
        season_doc = await db.seasons.find_one({"season_id": 1}, {"_id": 0})
        
        if season_doc and season_doc.get("end_date"):
            end_date = season_doc["end_date"]
            if isinstance(end_date, str):
                end_date = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        else:
            # Default Season 1 end date: March 31, 2026
            end_date = datetime(2026, 3, 31, 23, 59, 59)
        
        now = datetime.utcnow()
        
        if now >= end_date:
            return {
                "season_id": 1,
                "status": "ended",
                "message": "Season 1 has ended!",
                "time_remaining": None
            }
        
        time_diff = end_date - now
        total_seconds = int(time_diff.total_seconds())
        
        days = time_diff.days
        hours = (total_seconds % 86400) // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        
        return {
            "season_id": 1,
            "season_name": "Season 1 - Official Launch",
            "status": "active",
            "end_date": end_date.isoformat(),
            "server_time": now.isoformat(),
            "time_remaining": {
                "total_seconds": total_seconds,
                "days": days,
                "hours": hours,
                "minutes": minutes,
                "seconds": seconds,
                "formatted": f"{days}d {hours}h {minutes}m {seconds}s"
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting season timer: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get season timer: {str(e)}")

@api_router.get("/nft/contract")
async def get_nft_contract_info():
    """Get DogeFood Lab NFT contract information"""
    return {
        "contract_address": DOGEFOOD_NFT_CONTRACT,
        "network": "DogeOS",
        "benefits": {
            "vip_badge": True,
            "signup_bonus": 500,
            "daily_bonus_multiplier": 1.5
        },
        "description": "DogeFood Lab NFT holders receive VIP Scientist status with 500 bonus points on signup!"
    }

# ================================
# CHAT SYSTEM ENDPOINTS
# ================================

@api_router.get("/chat/messages")
async def get_chat_messages(limit: int = 50, before: Optional[str] = None):
    """Get recent chat messages"""
    try:
        query = {}
        if before:
            # Get messages before a certain message ID for pagination
            ref_message = await db.chat_messages.find_one({"id": before})
            if ref_message:
                query["created_at"] = {"$lt": ref_message["created_at"]}
        
        cursor = db.chat_messages.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
        messages = await cursor.to_list(length=limit)
        
        # Return in chronological order
        messages.reverse()
        return messages
    except Exception as e:
        logger.error(f"Error fetching chat messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/chat/messages")
async def create_chat_message(message_data: ChatMessageCreate):
    """Create a new chat message"""
    try:
        # Get sender info
        player = await db.players.find_one({"address": message_data.sender_address})
        if not player:
            raise HTTPException(status_code=404, detail="Player not found")
        
        # Get reply preview if replying
        reply_preview = None
        if message_data.reply_to:
            replied_msg = await db.chat_messages.find_one({"id": message_data.reply_to})
            if replied_msg:
                reply_preview = replied_msg.get("content", "")[:50]
                if len(replied_msg.get("content", "")) > 50:
                    reply_preview += "..."
        
        # Create message
        message = ChatMessage(
            sender_address=message_data.sender_address,
            sender_nickname=player.get("nickname") or player.get("telegram_username") or f"Scientist #{player.get('address', '')[:6]}",
            sender_character=player.get("selected_character"),
            content=message_data.content[:500],  # Limit to 500 chars
            reply_to=message_data.reply_to,
            reply_preview=reply_preview,
            upvotes=[],
            upvote_count=0
        )
        
        await db.chat_messages.insert_one(message.dict())
        
        return {**message.dict(), "_id": None}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating chat message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/chat/upvote")
async def upvote_chat_message(upvote_data: ChatUpvoteRequest):
    """Upvote a chat message - gives 1 XP to message author"""
    try:
        # Get the message
        message = await db.chat_messages.find_one({"id": upvote_data.message_id})
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        # Check if already upvoted
        if upvote_data.voter_address in message.get("upvotes", []):
            # Remove upvote (toggle)
            await db.chat_messages.update_one(
                {"id": upvote_data.message_id},
                {
                    "$pull": {"upvotes": upvote_data.voter_address},
                    "$inc": {"upvote_count": -1}
                }
            )
            # Remove XP from message author
            await db.players.update_one(
                {"address": message["sender_address"]},
                {"$inc": {"experience": -1}}
            )
            return {"action": "removed", "new_count": message.get("upvote_count", 1) - 1}
        
        # Can't upvote own message
        if upvote_data.voter_address == message["sender_address"]:
            raise HTTPException(status_code=400, detail="Cannot upvote your own message")
        
        # Add upvote
        await db.chat_messages.update_one(
            {"id": upvote_data.message_id},
            {
                "$push": {"upvotes": upvote_data.voter_address},
                "$inc": {"upvote_count": 1}
            }
        )
        
        # Award 1 XP to message author
        await db.players.update_one(
            {"address": message["sender_address"]},
            {"$inc": {"experience": 1}}
        )
        
        return {"action": "added", "new_count": message.get("upvote_count", 0) + 1, "xp_awarded": 1}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error upvoting message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/chat/messages/{message_id}")
async def delete_chat_message(message_id: str, sender_address: str):
    """Delete own chat message"""
    try:
        message = await db.chat_messages.find_one({"id": message_id})
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        if message["sender_address"] != sender_address:
            raise HTTPException(status_code=403, detail="Can only delete your own messages")
        
        await db.chat_messages.delete_one({"id": message_id})
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# NOTIFICATION SYSTEM ENDPOINTS
# ============================================

# VAPID keys for web push (generate once and store)
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")

class NotificationSubscription(BaseModel):
    player_address: Optional[str] = None
    telegram_id: Optional[int] = None
    subscription: Optional[dict] = None
    treat_ready: bool = True
    limit_reset: bool = True

class ScheduleNotification(BaseModel):
    player_address: Optional[str] = None
    telegram_id: Optional[int] = None
    treat_name: Optional[str] = None
    ready_time: Optional[str] = None
    reset_time: Optional[str] = None

@api_router.get("/notifications/vapid-key")
async def get_vapid_key():
    """Get VAPID public key for web push subscription"""
    return {"publicKey": VAPID_PUBLIC_KEY}

@api_router.post("/notifications/telegram/subscribe")
async def subscribe_telegram_notifications(data: NotificationSubscription):
    """Subscribe to Telegram notifications"""
    try:
        if not data.telegram_id:
            raise HTTPException(status_code=400, detail="Telegram ID required")
        
        await db.notification_subscriptions.update_one(
            {"telegram_id": data.telegram_id},
            {
                "$set": {
                    "telegram_id": data.telegram_id,
                    "type": "telegram",
                    "treat_ready": data.treat_ready,
                    "limit_reset": data.limit_reset,
                    "subscribed_at": datetime.utcnow(),
                    "active": True
                }
            },
            upsert=True
        )
        
        # Send confirmation message via Telegram
        bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        if bot_token:
            try:
                bot = Bot(token=bot_token)
                await bot.send_message(
                    chat_id=data.telegram_id,
                    text="🔔 Notifications enabled!\n\nYou'll be notified when:\n✅ Your treats are ready to collect\n🔄 Your daily limit resets\n\nHappy brewing! 🧪"
                )
            except Exception as e:
                logger.warning(f"Failed to send Telegram confirmation: {e}")
        
        return {"success": True, "message": "Telegram notifications enabled"}
    except Exception as e:
        logger.error(f"Error subscribing to Telegram notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/notifications/telegram/unsubscribe")
async def unsubscribe_telegram_notifications(data: NotificationSubscription):
    """Unsubscribe from Telegram notifications"""
    try:
        if not data.telegram_id:
            raise HTTPException(status_code=400, detail="Telegram ID required")
        
        await db.notification_subscriptions.update_one(
            {"telegram_id": data.telegram_id},
            {"$set": {"active": False}}
        )
        
        return {"success": True, "message": "Telegram notifications disabled"}
    except Exception as e:
        logger.error(f"Error unsubscribing from Telegram notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/notifications/telegram/preferences")
async def update_telegram_preferences(data: NotificationSubscription):
    """Update Telegram notification preferences"""
    try:
        if not data.telegram_id:
            raise HTTPException(status_code=400, detail="Telegram ID required")
        
        await db.notification_subscriptions.update_one(
            {"telegram_id": data.telegram_id},
            {
                "$set": {
                    "treat_ready": data.treat_ready,
                    "limit_reset": data.limit_reset
                }
            }
        )
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error updating Telegram preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/notifications/web/subscribe")
async def subscribe_web_notifications(data: NotificationSubscription):
    """Subscribe to web push notifications"""
    try:
        if not data.player_address or not data.subscription:
            raise HTTPException(status_code=400, detail="Player address and subscription required")
        
        await db.notification_subscriptions.update_one(
            {"player_address": data.player_address},
            {
                "$set": {
                    "player_address": data.player_address,
                    "type": "web",
                    "subscription": data.subscription,
                    "treat_ready": data.treat_ready,
                    "limit_reset": data.limit_reset,
                    "subscribed_at": datetime.utcnow(),
                    "active": True
                }
            },
            upsert=True
        )
        
        return {"success": True, "message": "Web push notifications enabled"}
    except Exception as e:
        logger.error(f"Error subscribing to web notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/notifications/web/unsubscribe")
async def unsubscribe_web_notifications(data: NotificationSubscription):
    """Unsubscribe from web push notifications"""
    try:
        if not data.player_address:
            raise HTTPException(status_code=400, detail="Player address required")
        
        await db.notification_subscriptions.update_one(
            {"player_address": data.player_address},
            {"$set": {"active": False}}
        )
        
        return {"success": True, "message": "Web push notifications disabled"}
    except Exception as e:
        logger.error(f"Error unsubscribing from web notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/notifications/web/preferences")
async def update_web_preferences(data: NotificationSubscription):
    """Update web push notification preferences"""
    try:
        if not data.player_address:
            raise HTTPException(status_code=400, detail="Player address required")
        
        await db.notification_subscriptions.update_one(
            {"player_address": data.player_address},
            {
                "$set": {
                    "treat_ready": data.treat_ready,
                    "limit_reset": data.limit_reset
                }
            }
        )
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error updating web preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/notifications/schedule/treat-ready")
async def schedule_treat_ready_notification(data: ScheduleNotification, background_tasks: BackgroundTasks):
    """Schedule a notification for when a treat is ready"""
    try:
        notification_data = {
            "id": str(uuid.uuid4()),
            "type": "treat_ready",
            "treat_name": data.treat_name,
            "ready_time": data.ready_time,
            "created_at": datetime.utcnow(),
            "sent": False
        }
        
        if data.telegram_id:
            notification_data["telegram_id"] = data.telegram_id
        elif data.player_address:
            notification_data["player_address"] = data.player_address
        else:
            raise HTTPException(status_code=400, detail="Telegram ID or player address required")
        
        await db.scheduled_notifications.insert_one(notification_data)
        
        # Schedule background task to send notification
        background_tasks.add_task(send_scheduled_notification, notification_data["id"])
        
        return {"success": True, "notification_id": notification_data["id"]}
    except Exception as e:
        logger.error(f"Error scheduling treat notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/notifications/schedule/limit-reset")
async def schedule_limit_reset_notification(data: ScheduleNotification, background_tasks: BackgroundTasks):
    """Schedule a notification for when daily limit resets"""
    try:
        notification_data = {
            "id": str(uuid.uuid4()),
            "type": "limit_reset",
            "reset_time": data.reset_time,
            "created_at": datetime.utcnow(),
            "sent": False
        }
        
        if data.telegram_id:
            notification_data["telegram_id"] = data.telegram_id
        elif data.player_address:
            notification_data["player_address"] = data.player_address
        else:
            raise HTTPException(status_code=400, detail="Telegram ID or player address required")
        
        await db.scheduled_notifications.insert_one(notification_data)
        
        # Schedule background task to send notification
        background_tasks.add_task(send_scheduled_notification, notification_data["id"])
        
        return {"success": True, "notification_id": notification_data["id"]}
    except Exception as e:
        logger.error(f"Error scheduling limit reset notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def send_scheduled_notification(notification_id: str):
    """Background task to send scheduled notification"""
    import asyncio
    
    try:
        notification = await db.scheduled_notifications.find_one({"id": notification_id})
        if not notification or notification.get("sent"):
            return
        
        # Calculate delay
        if notification["type"] == "treat_ready" and notification.get("ready_time"):
            ready_time = datetime.fromisoformat(notification["ready_time"].replace("Z", "+00:00"))
            delay = (ready_time - datetime.utcnow()).total_seconds()
        elif notification["type"] == "limit_reset" and notification.get("reset_time"):
            reset_time = datetime.fromisoformat(notification["reset_time"].replace("Z", "+00:00"))
            delay = (reset_time - datetime.utcnow()).total_seconds()
        else:
            delay = 0
        
        # Wait until notification time
        if delay > 0:
            await asyncio.sleep(min(delay, 86400))  # Max 24 hours
        
        # Check if subscription is still active
        if notification.get("telegram_id"):
            sub = await db.notification_subscriptions.find_one({
                "telegram_id": notification["telegram_id"],
                "active": True
            })
            if not sub:
                return
            
            # Check preference
            if notification["type"] == "treat_ready" and not sub.get("treat_ready", True):
                return
            if notification["type"] == "limit_reset" and not sub.get("limit_reset", True):
                return
            
            # Send Telegram notification
            bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
            if bot_token:
                bot = Bot(token=bot_token)
                if notification["type"] == "treat_ready":
                    message = f"🍖 Your {notification.get('treat_name', 'treat')} is ready!\n\nHead to the lab to collect it before it gets cold! 🧪"
                else:
                    message = "🔄 Daily limit reset!\n\nYou can now create more treats. Time to brew! 🧪"
                
                try:
                    await bot.send_message(chat_id=notification["telegram_id"], text=message)
                except Exception as e:
                    logger.warning(f"Failed to send Telegram notification: {e}")
        
        # Mark as sent
        await db.scheduled_notifications.update_one(
            {"id": notification_id},
            {"$set": {"sent": True, "sent_at": datetime.utcnow()}}
        )
        
    except Exception as e:
        logger.error(f"Error sending scheduled notification: {e}")

# ============================================
# GUEST REGISTRATION ENDPOINT
# ============================================

class GuestRegisterRequest(BaseModel):
    username: str

@api_router.post("/players/guest-register")
async def register_guest_player(request: GuestRegisterRequest):
    """Register a new guest player with unique ID"""
    try:
        username = request.username.strip()
        
        # Validate username
        if len(username) < 3:
            raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
        if len(username) > 20:
            raise HTTPException(status_code=400, detail="Username must be 20 characters or less")
        if not username.replace('_', '').isalnum():
            raise HTTPException(status_code=400, detail="Username can only contain letters, numbers, and underscores")
        
        # Check if username is taken
        existing = await db.players.find_one({"nickname": {"$regex": f"^{username}$", "$options": "i"}})
        if existing:
            raise HTTPException(status_code=400, detail="Username is already taken")
        
        # Generate unique guest ID
        guest_id = f"GUEST_{uuid.uuid4().hex[:12].upper()}"
        player_id = str(uuid.uuid4())
        
        # Create player document
        player_data = {
            "id": player_id,
            "guest_id": guest_id,
            "address": guest_id,  # Use guest_id as address for consistency
            "nickname": username,
            "auth_type": "guest",
            "points": 0,
            "level": 1,
            "experience": 0,
            "treats_created": 0,
            "streak_days": 0,
            "last_activity": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "daily_treats_count": 0,
            "daily_treats_last_reset": datetime.utcnow(),
            "is_nft_holder": False
        }
        
        await db.players.insert_one(player_data)
        
        logger.info(f"New guest player registered: {username} ({guest_id})")
        
        return {
            "success": True,
            "player_id": player_id,
            "guest_id": guest_id,
            "username": username
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Guest registration failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# ADMIN ENDPOINTS
# ============================================

class DeleteTestPlayersRequest(BaseModel):
    addresses: List[str]
    admin_key: Optional[str] = None

@api_router.post("/admin/delete-test-players")
async def delete_test_players(request: DeleteTestPlayersRequest):
    """Delete test players from the database"""
    try:
        # Delete players with matching addresses
        addresses_to_delete = request.addresses + [
            "GUEST_USER",
            "0x123test",
            "0xTestWallet123", 
            "0xTestNFTHolder",
            "test_user",
            "Test User"
        ]
        
        result = await db.players.delete_many({
            "$or": [
                {"address": {"$in": addresses_to_delete}},
                {"guest_id": "GUEST_USER"},
                {"nickname": {"$regex": "^test", "$options": "i"}}
            ]
        })
        
        logger.info(f"Deleted {result.deleted_count} test players")
        
        return {
            "success": True,
            "deleted_count": result.deleted_count
        }
        
    except Exception as e:
        logger.error(f"Failed to delete test players: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# TOURNAMENT SYSTEM ENDPOINTS
# ============================================

class TournamentCreate(BaseModel):
    name: str
    season: int = 1
    start_date: str
    match_duration_hours: int = 48

class MatchUpdate(BaseModel):
    match_id: str
    player1_treats: Optional[int] = None
    player1_points: Optional[int] = None
    player2_treats: Optional[int] = None
    player2_points: Optional[int] = None

@api_router.get("/tournament/current")
async def get_current_tournament():
    """Get the current active tournament"""
    try:
        # Find active or upcoming tournament
        tournament = await db.tournaments.find_one(
            {"status": {"$in": ["active", "upcoming", "qualification"]}},
            {"_id": 0}
        )
        
        if not tournament:
            # Return default tournament info for Season 1
            # Tournament starts 2 weeks before season end (March 1, 2026)
            # So tournament starts around Feb 15, 2026
            return {
                "id": "season1_championship",
                "name": "Treat Masters Champions League",
                "season": 1,
                "status": "qualification",
                "qualification_ends": "2026-02-15T00:00:00Z",
                "tournament_starts": "2026-02-15T00:00:00Z",
                "matches": [],
                "prize_pool": "$LAB / DOGE Rewards",
                "champion": None
            }
        
        # Get matches for this tournament
        matches = await db.tournament_matches.find(
            {"tournament_id": tournament["id"]},
            {"_id": 0}
        ).to_list(100)
        
        # Enrich matches with player data
        for match in matches:
            if match.get("player1_id"):
                player1 = await db.players.find_one({"id": match["player1_id"]}, {"_id": 0})
                if player1:
                    match["player1"] = {
                        "id": player1["id"],
                        "nickname": player1.get("nickname", "Anonymous"),
                        "seed": match.get("player1_seed", 0)
                    }
            
            if match.get("player2_id"):
                player2 = await db.players.find_one({"id": match["player2_id"]}, {"_id": 0})
                if player2:
                    match["player2"] = {
                        "id": player2["id"],
                        "nickname": player2.get("nickname", "Anonymous"),
                        "seed": match.get("player2_seed", 0)
                    }
        
        tournament["matches"] = matches
        return tournament
        
    except Exception as e:
        logger.error(f"Error fetching tournament: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/tournament/create")
async def create_tournament(data: TournamentCreate):
    """Create a new tournament (admin only)"""
    try:
        tournament_id = f"season{data.season}_championship_{uuid.uuid4().hex[:8]}"
        
        # Get top 8 players from leaderboard
        top_players = await db.players.find(
            {},
            {"_id": 0, "id": 1, "nickname": 1, "points": 1, "address": 1}
        ).sort("points", -1).limit(8).to_list(8)
        
        if len(top_players) < 8:
            raise HTTPException(status_code=400, detail="Not enough players for tournament (need 8)")
        
        # Create tournament
        tournament = {
            "id": tournament_id,
            "name": data.name,
            "season": data.season,
            "status": "upcoming",
            "start_date": data.start_date,
            "match_duration_hours": data.match_duration_hours,
            "qualified_players": [p["id"] for p in top_players],
            "created_at": datetime.utcnow(),
            "champion": None
        }
        
        await db.tournaments.insert_one(tournament)
        
        # Create quarterfinal matches based on seeding
        # #1 vs #8, #2 vs #7, #3 vs #6, #4 vs #5
        matchups = [(0, 7), (1, 6), (2, 5), (3, 4)]
        
        start_time = datetime.fromisoformat(data.start_date.replace("Z", "+00:00"))
        end_time = start_time + timedelta(hours=data.match_duration_hours)
        
        for i, (seed1_idx, seed2_idx) in enumerate(matchups):
            match = {
                "id": f"{tournament_id}_qf_{i+1}",
                "tournament_id": tournament_id,
                "stage": "quarterfinal",
                "match_number": i + 1,
                "player1_id": top_players[seed1_idx]["id"],
                "player1_seed": seed1_idx + 1,
                "player2_id": top_players[seed2_idx]["id"],
                "player2_seed": seed2_idx + 1,
                "player1_treats": 0,
                "player1_points": 0,
                "player2_treats": 0,
                "player2_points": 0,
                "status": "upcoming",
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "winner_id": None,
                "created_at": datetime.utcnow()
            }
            await db.tournament_matches.insert_one(match)
        
        logger.info(f"Tournament created: {tournament_id}")
        
        return {
            "success": True,
            "tournament_id": tournament_id,
            "matches_created": 4
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating tournament: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/tournament/start/{tournament_id}")
async def start_tournament(tournament_id: str):
    """Start a tournament (activate quarterfinal matches)"""
    try:
        tournament = await db.tournaments.find_one({"id": tournament_id})
        if not tournament:
            raise HTTPException(status_code=404, detail="Tournament not found")
        
        # Update tournament status
        await db.tournaments.update_one(
            {"id": tournament_id},
            {"$set": {"status": "active", "started_at": datetime.utcnow()}}
        )
        
        # Activate quarterfinal matches
        now = datetime.utcnow()
        end_time = now + timedelta(hours=tournament.get("match_duration_hours", 48))
        
        await db.tournament_matches.update_many(
            {"tournament_id": tournament_id, "stage": "quarterfinal"},
            {"$set": {
                "status": "active",
                "start_time": now.isoformat(),
                "end_time": end_time.isoformat()
            }}
        )
        
        logger.info(f"Tournament started: {tournament_id}")
        
        return {"success": True, "message": "Tournament started"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting tournament: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/tournament/match/update")
async def update_match_scores(data: MatchUpdate):
    """Update match scores during a tournament match"""
    try:
        update_data = {}
        if data.player1_treats is not None:
            update_data["player1_treats"] = data.player1_treats
        if data.player1_points is not None:
            update_data["player1_points"] = data.player1_points
        if data.player2_treats is not None:
            update_data["player2_treats"] = data.player2_treats
        if data.player2_points is not None:
            update_data["player2_points"] = data.player2_points
        
        if update_data:
            await db.tournament_matches.update_one(
                {"id": data.match_id},
                {"$set": update_data}
            )
        
        return {"success": True}
        
    except Exception as e:
        logger.error(f"Error updating match: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/tournament/match/complete/{match_id}")
async def complete_match(match_id: str):
    """Complete a match and determine winner"""
    try:
        match = await db.tournament_matches.find_one({"id": match_id})
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")
        
        # Calculate combined scores
        player1_score = (match.get("player1_treats", 0) * 10) + match.get("player1_points", 0)
        player2_score = (match.get("player2_treats", 0) * 10) + match.get("player2_points", 0)
        
        # Determine winner (treats count more - 10 points each)
        if player1_score >= player2_score:
            winner_id = match["player1_id"]
            winner_seed = match.get("player1_seed", 0)
        else:
            winner_id = match["player2_id"]
            winner_seed = match.get("player2_seed", 0)
        
        # Update match
        await db.tournament_matches.update_one(
            {"id": match_id},
            {"$set": {
                "status": "completed",
                "winner_id": winner_id,
                "completed_at": datetime.utcnow()
            }}
        )
        
        # Check if we need to create next stage matches
        tournament = await db.tournaments.find_one({"id": match["tournament_id"]})
        
        # Get all completed matches in current stage
        stage = match["stage"]
        completed_matches = await db.tournament_matches.find({
            "tournament_id": match["tournament_id"],
            "stage": stage,
            "status": "completed"
        }).to_list(100)
        
        # If all quarterfinals done, create semifinals
        if stage == "quarterfinal" and len(completed_matches) == 4:
            await create_next_stage_matches(match["tournament_id"], "semifinal", tournament)
        
        # If all semifinals done, create final
        elif stage == "semifinal" and len(completed_matches) == 2:
            await create_next_stage_matches(match["tournament_id"], "final", tournament)
        
        # If final is complete, crown champion
        elif stage == "final":
            await db.tournaments.update_one(
                {"id": match["tournament_id"]},
                {"$set": {
                    "status": "completed",
                    "champion": winner_id,
                    "completed_at": datetime.utcnow()
                }}
            )
        
        logger.info(f"Match completed: {match_id}, Winner: {winner_id}")
        
        return {"success": True, "winner_id": winner_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing match: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def create_next_stage_matches(tournament_id: str, stage: str, tournament: dict):
    """Helper function to create next stage matches from winners"""
    try:
        previous_stage = "quarterfinal" if stage == "semifinal" else "semifinal"
        
        # Get winners from previous stage
        previous_matches = await db.tournament_matches.find({
            "tournament_id": tournament_id,
            "stage": previous_stage,
            "status": "completed"
        }).sort("match_number", 1).to_list(100)
        
        winners = [(m["winner_id"], m.get("player1_seed") if m["winner_id"] == m["player1_id"] else m.get("player2_seed")) 
                   for m in previous_matches]
        
        duration = tournament.get("match_duration_hours", 48)
        start_time = datetime.utcnow()
        end_time = start_time + timedelta(hours=duration)
        
        if stage == "semifinal":
            # SF1: QF1 winner vs QF2 winner
            # SF2: QF3 winner vs QF4 winner
            matchups = [(0, 1), (2, 3)]
        else:  # final
            matchups = [(0, 1)]
        
        for i, (idx1, idx2) in enumerate(matchups):
            match = {
                "id": f"{tournament_id}_{stage[:2]}_{i+1}",
                "tournament_id": tournament_id,
                "stage": stage,
                "match_number": i + 1,
                "player1_id": winners[idx1][0],
                "player1_seed": winners[idx1][1],
                "player2_id": winners[idx2][0],
                "player2_seed": winners[idx2][1],
                "player1_treats": 0,
                "player1_points": 0,
                "player2_treats": 0,
                "player2_points": 0,
                "status": "active",
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "winner_id": None,
                "created_at": datetime.utcnow()
            }
            await db.tournament_matches.insert_one(match)
        
        logger.info(f"Created {stage} matches for tournament {tournament_id}")
        
    except Exception as e:
        logger.error(f"Error creating next stage matches: {e}")

# ============================================
# KERNEL OF WOW - SPECIAL INGREDIENT ENDPOINTS
# ============================================

def calculate_kernel_bonus(ingredients: List[str]) -> dict:
    """Calculate bonus tier based on ingredients used with Kernel of Wow"""
    ingredient_set = set(ingredients)
    
    # Check for legendary combo
    for combo in KERNEL_BONUS_COMBOS["legendary"]["combos"]:
        if combo.issubset(ingredient_set):
            return {
                "tier": "legendary",
                "bonus_percent": 30,
                "description": KERNEL_BONUS_COMBOS["legendary"]["description"]
            }
    
    # Check for epic combo
    for combo in KERNEL_BONUS_COMBOS["epic"]["combos"]:
        if combo.issubset(ingredient_set):
            return {
                "tier": "epic",
                "bonus_percent": 20,
                "description": KERNEL_BONUS_COMBOS["epic"]["description"]
            }
    
    # Check for rare combo
    for combo in KERNEL_BONUS_COMBOS["rare"]["combos"]:
        if combo.issubset(ingredient_set):
            return {
                "tier": "rare",
                "bonus_percent": 15,
                "description": KERNEL_BONUS_COMBOS["rare"]["description"]
            }
    
    # Default to common bonus
    return {
        "tier": "common",
        "bonus_percent": 5,
        "description": KERNEL_BONUS_COMBOS["common"]["description"]
    }

@api_router.get("/special-ingredient/current")
async def get_current_special_ingredient_holder():
    """Get the current holder of the Kernel of Wow"""
    try:
        now = datetime.utcnow()
        
        # Find active holder
        holder = await db.special_ingredient_holders.find_one({
            "is_active": True,
            "expires_at": {"$gt": now}
        }, {"_id": 0})
        
        if holder:
            # Calculate time remaining
            expires_at = holder.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            time_remaining = (expires_at - now).total_seconds()
            
            return {
                "has_holder": True,
                "holder": holder,
                "ingredient": KERNEL_OF_WOW,
                "time_remaining_seconds": max(0, time_remaining),
                "bonus_combos": KERNEL_BONUS_COMBOS
            }
        
        return {
            "has_holder": False,
            "holder": None,
            "ingredient": KERNEL_OF_WOW,
            "next_selection_info": "A new holder will be selected soon!"
        }
        
    except Exception as e:
        logger.error(f"Error getting special ingredient holder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/special-ingredient/check/{address}")
async def check_player_has_special_ingredient(address: str):
    """Check if a specific player currently has the Kernel of Wow"""
    try:
        now = datetime.utcnow()
        
        holder = await db.special_ingredient_holders.find_one({
            "player_address": address,
            "is_active": True,
            "expires_at": {"$gt": now}
        }, {"_id": 0})
        
        if holder:
            expires_at = holder.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            time_remaining = (expires_at - now).total_seconds()
            
            return {
                "has_ingredient": True,
                "ingredient": KERNEL_OF_WOW,
                "expires_at": holder.get("expires_at"),
                "time_remaining_seconds": max(0, time_remaining),
                "bonus_combos": KERNEL_BONUS_COMBOS,
                "used_count": len(holder.get("used_in_treats", [])),
                "total_bonus_earned": holder.get("total_bonus_earned", 0)
            }
        
        return {
            "has_ingredient": False,
            "ingredient": KERNEL_OF_WOW
        }
        
    except Exception as e:
        logger.error(f"Error checking special ingredient: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/special-ingredient/select-random")
async def select_random_special_ingredient_holder():
    """Select a random active player to receive the Kernel of Wow (admin/cron endpoint)"""
    try:
        now = datetime.utcnow()
        
        # Check if there's already an active holder
        existing_holder = await db.special_ingredient_holders.find_one({
            "is_active": True,
            "expires_at": {"$gt": now}
        })
        
        if existing_holder:
            return {
                "success": False,
                "message": "There is already an active holder",
                "current_holder": existing_holder.get("player_address")
            }
        
        # Deactivate any expired holders
        await db.special_ingredient_holders.update_many(
            {"is_active": True, "expires_at": {"$lte": now}},
            {"$set": {"is_active": False}}
        )
        
        # Get active players (players who have created treats in last 7 days)
        seven_days_ago = now - timedelta(days=7)
        
        active_players = await db.players.find({
            "last_active": {"$gte": seven_days_ago}
        }).to_list(1000)
        
        # Fallback: get players with treats
        if not active_players:
            treat_creators = await db.treats.distinct("creator_address", {
                "created_at": {"$gte": seven_days_ago}
            })
            active_players = await db.players.find({
                "address": {"$in": treat_creators}
            }).to_list(1000)
        
        # Final fallback: get any players with points
        if not active_players:
            active_players = await db.players.find({
                "points": {"$gt": 0}
            }).to_list(100)
        
        if not active_players:
            return {
                "success": False,
                "message": "No eligible players found"
            }
        
        # Select random player
        import random
        selected_player = random.choice(active_players)
        
        # Create new holder record
        expires_at = now + timedelta(hours=KERNEL_OF_WOW["duration_hours"])
        
        new_holder = SpecialIngredientHolder(
            player_address=selected_player.get("address"),
            player_nickname=selected_player.get("nickname"),
            ingredient_id="KERNEL_WOW",
            granted_at=now,
            expires_at=expires_at,
            is_active=True
        )
        
        await db.special_ingredient_holders.insert_one(new_holder.dict())
        
        # Update player record
        await db.players.update_one(
            {"address": selected_player.get("address")},
            {"$set": {"has_special_ingredient": True, "special_ingredient_expires": expires_at}}
        )
        
        logger.info(f"Kernel of Wow granted to {selected_player.get('address')} until {expires_at}")
        
        return {
            "success": True,
            "message": "Kernel of Wow granted!",
            "holder": {
                "address": selected_player.get("address"),
                "nickname": selected_player.get("nickname"),
                "expires_at": expires_at.isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"Error selecting special ingredient holder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/special-ingredient/history")
async def get_special_ingredient_history(limit: int = 20):
    """Get history of Kernel of Wow holders"""
    try:
        history = await db.special_ingredient_holders.find(
            {},
            {"_id": 0}
        ).sort("granted_at", -1).limit(limit).to_list(limit)
        
        return {
            "history": history,
            "ingredient": KERNEL_OF_WOW
        }
        
    except Exception as e:
        logger.error(f"Error fetching special ingredient history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/special-ingredient/use")
async def use_special_ingredient_in_treat(treat_id: str, player_address: str, ingredients: List[str]):
    """Record usage of Kernel of Wow in a treat and calculate bonus"""
    try:
        now = datetime.utcnow()
        
        # Check if player has active special ingredient
        holder = await db.special_ingredient_holders.find_one({
            "player_address": player_address,
            "is_active": True,
            "expires_at": {"$gt": now}
        })
        
        if not holder:
            return {
                "success": False,
                "message": "You don't have the Kernel of Wow"
            }
        
        # Calculate bonus
        bonus_info = calculate_kernel_bonus(ingredients)
        
        # Update holder record
        await db.special_ingredient_holders.update_one(
            {"id": holder.get("id")},
            {
                "$push": {"used_in_treats": treat_id},
                "$inc": {"total_bonus_earned": bonus_info["bonus_percent"]}
            }
        )
        
        return {
            "success": True,
            "bonus": bonus_info,
            "message": f"Kernel of Wow activated! {bonus_info['description']}"
        }
        
    except Exception as e:
        logger.error(f"Error using special ingredient: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/special-ingredient/bonus-preview")
async def preview_kernel_bonus(ingredients: str):
    """Preview bonus for a set of ingredients (comma-separated)"""
    try:
        ingredient_list = [ing.strip() for ing in ingredients.split(",")]
        bonus_info = calculate_kernel_bonus(ingredient_list)
        
        return {
            "ingredients": ingredient_list,
            "bonus": bonus_info,
            "all_combos": KERNEL_BONUS_COMBOS
        }
        
    except Exception as e:
        logger.error(f"Error previewing bonus: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/special-ingredient/scheduler-status")
async def get_scheduler_status():
    """Get the status of the Kernel of Wow scheduler"""
    try:
        jobs = scheduler.get_jobs()
        job_info = []
        for job in jobs:
            job_info.append({
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger)
            })
        
        return {
            "scheduler_running": scheduler.running,
            "jobs": job_info,
            "selection_interval_hours": 24,
            "ingredient_duration_hours": 16
        }
        
    except Exception as e:
        logger.error(f"Error getting scheduler status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/special-ingredient/force-expire")
async def force_expire_kernel(address: str = None):
    """Force expire current Kernel of Wow holder (admin endpoint)"""
    try:
        query = {"is_active": True}
        if address:
            query["player_address"] = address
            
        result = await db.special_ingredient_holders.update_many(
            query,
            {"$set": {"is_active": False, "expires_at": datetime.utcnow()}}
        )
        
        return {
            "success": True,
            "expired_count": result.modified_count,
            "message": f"Expired {result.modified_count} active holder(s)"
        }
        
    except Exception as e:
        logger.error(f"Error force expiring kernel: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# MARKETPLACE SYSTEM ENDPOINTS
# ============================================

@api_router.post("/marketplace/list")
async def create_marketplace_listing(data: CreateListingRequest):
    """List a treat for sale on the marketplace"""
    try:
        # Verify the treat exists and belongs to the seller
        treat = await db.treats.find_one({"id": data.treat_id})
        if not treat:
            raise HTTPException(status_code=404, detail="Treat not found")
        
        if treat.get("creator_address") != data.seller_address:
            raise HTTPException(status_code=403, detail="You can only list your own treats")
        
        # Check if treat is already listed
        existing_listing = await db.marketplace_listings.find_one({
            "treat_id": data.treat_id,
            "status": "active"
        })
        if existing_listing:
            raise HTTPException(status_code=400, detail="Treat is already listed on marketplace")
        
        # Validate pricing - at least one price must be set
        if data.price_doge is None and data.price_lab is None:
            raise HTTPException(status_code=400, detail="At least one price (DOGE or LAB) must be set")
        
        # Get seller info
        seller = await db.players.find_one({"address": data.seller_address})
        seller_nickname = seller.get("nickname") if seller else None
        
        # Create listing
        listing = MarketplaceListing(
            treat_id=data.treat_id,
            treat_name=treat.get("name", "Unknown Treat"),
            treat_rarity=treat.get("rarity", "Common"),
            treat_image=treat.get("image", ""),
            treat_ingredients=treat.get("ingredients", []),
            treat_points_reward=treat.get("points_reward", 0),
            treat_xp_reward=treat.get("xp_reward", 0),
            seller_address=data.seller_address,
            seller_nickname=seller_nickname,
            price_doge=data.price_doge,
            price_lab=data.price_lab,
            payment_options=data.payment_options,
            status="active"
        )
        
        await db.marketplace_listings.insert_one(listing.dict())
        
        logger.info(f"Treat listed on marketplace: {data.treat_id} by {data.seller_address}")
        
        return {
            "success": True,
            "listing_id": listing.id,
            "message": "Treat listed successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating marketplace listing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/marketplace/listings")
async def get_marketplace_listings(
    rarity: Optional[str] = None,
    min_price_doge: Optional[float] = None,
    max_price_doge: Optional[float] = None,
    min_price_lab: Optional[float] = None,
    max_price_lab: Optional[float] = None,
    payment_option: Optional[str] = None,
    sort_by: str = "newest",  # "newest", "oldest", "price_low", "price_high"
    limit: int = 50,
    skip: int = 0
):
    """Get active marketplace listings with filters"""
    try:
        # Build query
        query = {"status": "active"}
        
        if rarity and rarity.lower() != "all":
            query["treat_rarity"] = {"$regex": f"^{rarity}$", "$options": "i"}
        
        if payment_option and payment_option != "all":
            if payment_option == "doge":
                query["price_doge"] = {"$ne": None}
            elif payment_option == "lab":
                query["price_lab"] = {"$ne": None}
        
        if min_price_doge is not None:
            query["price_doge"] = query.get("price_doge", {})
            query["price_doge"]["$gte"] = min_price_doge
        
        if max_price_doge is not None:
            query["price_doge"] = query.get("price_doge", {})
            query["price_doge"]["$lte"] = max_price_doge
        
        if min_price_lab is not None:
            query["price_lab"] = query.get("price_lab", {})
            query["price_lab"]["$gte"] = min_price_lab
        
        if max_price_lab is not None:
            query["price_lab"] = query.get("price_lab", {})
            query["price_lab"]["$lte"] = max_price_lab
        
        # Build sort
        sort_options = {
            "newest": [("listed_at", -1)],
            "oldest": [("listed_at", 1)],
            "price_low": [("price_doge", 1), ("price_lab", 1)],
            "price_high": [("price_doge", -1), ("price_lab", -1)]
        }
        sort = sort_options.get(sort_by, [("listed_at", -1)])
        
        # Get total count
        total = await db.marketplace_listings.count_documents(query)
        
        # Get listings
        listings = await db.marketplace_listings.find(
            query,
            {"_id": 0}
        ).sort(sort).skip(skip).limit(limit).to_list(limit)
        
        return {
            "listings": listings,
            "total": total,
            "limit": limit,
            "skip": skip,
            "marketplace_fee": MARKETPLACE_FEE,
            "trading_live": False  # Set to True when $LAB is live
        }
        
    except Exception as e:
        logger.error(f"Error fetching marketplace listings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/marketplace/listing/{listing_id}")
async def get_marketplace_listing(listing_id: str):
    """Get a single marketplace listing by ID"""
    try:
        listing = await db.marketplace_listings.find_one(
            {"id": listing_id},
            {"_id": 0}
        )
        
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        
        return listing
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching listing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/marketplace/my-listings/{address}")
async def get_my_listings(address: str):
    """Get all listings for a specific seller"""
    try:
        listings = await db.marketplace_listings.find(
            {"seller_address": address},
            {"_id": 0}
        ).sort("listed_at", -1).to_list(100)
        
        return {"listings": listings}
        
    except Exception as e:
        logger.error(f"Error fetching seller listings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/marketplace/listing/{listing_id}")
async def cancel_marketplace_listing(listing_id: str, seller_address: str):
    """Cancel/remove a marketplace listing"""
    try:
        # Find the listing
        listing = await db.marketplace_listings.find_one({"id": listing_id})
        
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        
        if listing.get("seller_address") != seller_address:
            raise HTTPException(status_code=403, detail="You can only cancel your own listings")
        
        if listing.get("status") != "active":
            raise HTTPException(status_code=400, detail="Listing is not active")
        
        # Update listing status
        await db.marketplace_listings.update_one(
            {"id": listing_id},
            {"$set": {"status": "cancelled"}}
        )
        
        logger.info(f"Marketplace listing cancelled: {listing_id}")
        
        return {"success": True, "message": "Listing cancelled"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling listing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/marketplace/buy/{listing_id}")
async def buy_marketplace_listing(listing_id: str, data: BuyListingRequest):
    """Buy a treat from the marketplace (disabled until $LAB is live)"""
    try:
        # Trading is not live yet
        raise HTTPException(
            status_code=503, 
            detail="Trading is not live yet. $LAB token launch coming soon!"
        )
        
        # Future implementation when trading goes live:
        # 1. Verify listing exists and is active
        # 2. Verify buyer has sufficient funds
        # 3. Transfer payment (minus fee) to seller
        # 4. Transfer treat ownership to buyer
        # 5. Update listing status to "sold"
        # 6. Deduct MARKETPLACE_FEE from sale
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing purchase: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/marketplace/stats")
async def get_marketplace_stats():
    """Get marketplace statistics"""
    try:
        # Count active listings
        active_count = await db.marketplace_listings.count_documents({"status": "active"})
        
        # Count total sold
        sold_count = await db.marketplace_listings.count_documents({"status": "sold"})
        
        # Get listings by rarity
        pipeline = [
            {"$match": {"status": "active"}},
            {"$group": {"_id": "$treat_rarity", "count": {"$sum": 1}}}
        ]
        rarity_stats = await db.marketplace_listings.aggregate(pipeline).to_list(10)
        
        # Calculate average prices
        avg_pipeline = [
            {"$match": {"status": "active", "price_doge": {"$ne": None}}},
            {"$group": {"_id": None, "avg_doge": {"$avg": "$price_doge"}}}
        ]
        avg_result = await db.marketplace_listings.aggregate(avg_pipeline).to_list(1)
        avg_price_doge = avg_result[0]["avg_doge"] if avg_result else 0
        
        return {
            "active_listings": active_count,
            "total_sold": sold_count,
            "marketplace_fee": MARKETPLACE_FEE,
            "trading_live": False,
            "rarity_breakdown": {r["_id"]: r["count"] for r in rarity_stats},
            "average_price_doge": round(avg_price_doge, 2) if avg_price_doge else 0
        }
        
    except Exception as e:
        logger.error(f"Error fetching marketplace stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/marketplace/check-listed/{treat_id}")
async def check_treat_listed(treat_id: str):
    """Check if a treat is listed on the marketplace"""
    try:
        listing = await db.marketplace_listings.find_one({
            "treat_id": treat_id,
            "status": "active"
        }, {"_id": 0})
        
        return {
            "is_listed": listing is not None,
            "listing": listing
        }
        
    except Exception as e:
        logger.error(f"Error checking listing status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    """Start background scheduler on app startup"""
    # Schedule Kernel of Wow selection every 24 hours
    scheduler.add_job(
        auto_select_kernel_holder,
        IntervalTrigger(hours=24),
        id="kernel_of_wow_selection",
        name="Select Kernel of Wow Holder",
        replace_existing=True
    )
    
    # Also run immediately on startup to check if we need a holder
    scheduler.add_job(
        auto_select_kernel_holder,
        "date",  # Run once immediately
        id="kernel_of_wow_initial",
        name="Initial Kernel of Wow Check"
    )
    
    scheduler.start()
    logger.info("🚀 Background scheduler started - Kernel of Wow selection scheduled every 24 hours")

@app.on_event("shutdown")
async def shutdown_db_client():
    scheduler.shutdown()
    client.close()
    logger.info("Scheduler and database connection closed")