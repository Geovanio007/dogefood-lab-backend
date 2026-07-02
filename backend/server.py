from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Request, Query, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import urllib.parse
import random
import asyncio
from telegram import Bot
import httpx  # For Firebase verification
from eth_account import Account
from eth_account.messages import encode_defunct

# Standard logger setup. This was previously missing entirely — `import
# logging` was present but `logger` itself was never instantiated, even
# though logger.info/.warning/.error are called 230+ times throughout
# this file. The very first call (in startup_event, at app boot) raised
# NameError: name 'logger' is not defined and crashed the deploy before
# the app could finish starting.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s:%(name)s: %(message)s",
)
logger = logging.getLogger(__name__)




def parse_utc_datetime(dt_val) -> datetime:
    """Parse a datetime value (str or datetime) and ensure it's UTC-aware.
    Handles naive datetimes from the DB by assuming they are UTC."""
    if dt_val is None:
        return datetime.now(timezone.utc)
    if isinstance(dt_val, str):
        cleaned = dt_val.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(cleaned)
    else:
        parsed = dt_val
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed




async def find_player_by_address(address: str):
    """Find player by address, handling Telegram TG_/tg_ case mismatch
    and historical duplicate documents.

    For Telegram users, historical code paths created up to THREE separate
    player documents for the same user:
      A1) {address: "tg_<id>", telegram_id: null}    (lowercase, legacy)
      A2) {address: "TG_<id>", telegram_id: null}    (UPPERCASE, modern)
      B ) {address: null,     telegram_id: <int>}    (Telegram-auth doc)

    Because the previous lookup returned whichever doc matched FIRST in the
    fallback chain, a player's gameplay points (stored on one doc) could be
    permanently invisible to other endpoints that happened to find a
    different doc first.

    Fix: collect every candidate document and return the canonical one —
    defined as the doc with the most points (tie-breaker: most treats).
    This guarantees endpoints all converge on the same record regardless
    of the caller's case/prefix style.
    """
    if not address:
        return None

    # Non-Telegram (wallet / guest / 0x… / etc.): single exact lookup
    if not address.lower().startswith("tg_"):
        return await db.players.find_one({"address": address}, {"_id": 0})

    tg_id_str = address[3:]
    candidates = []
    seen_ids = set()

    def _add(p):
        if p and p.get("id") not in seen_ids:
            seen_ids.add(p.get("id"))
            candidates.append(p)

    # Gather every variant in parallel
    or_clauses = [
        {"address": address},
        {"address": f"TG_{tg_id_str}"},
        {"address": f"tg_{tg_id_str}"},
    ]
    try:
        or_clauses.append({"telegram_id": int(tg_id_str)})
    except (ValueError, TypeError):
        pass

    async for doc in db.players.find({"$or": or_clauses}, {"_id": 0}):
        _add(doc)

    if not candidates:
        return None

    # Pick the canonical document: highest points, then most treats created,
    # then most recent last_active. This is the doc that has actually been
    # receiving gameplay updates.
    def _rank(d):
        return (
            int(d.get("points") or 0),
            len(d.get("created_treats") or []),
            str(d.get("last_active") or ""),
        )

    return max(candidates, key=_rank)




def verify_wallet_signature(wallet_address: str, signature: str, message: str, expected_telegram_id, max_age_minutes: int = 15):
    """
    Verify that `signature` is a valid EIP-191 personal_sign signature of
    `message`, produced by the private key controlling `wallet_address`.

    Also checks that the message actually references `expected_telegram_id`
    (so a signature can't be lifted from an unrelated context and replayed
    here) and that it isn't stale (limits how long a captured signature
    stays usable, since there's no separate nonce store).

    Returns (True, None) on success, or (False, "reason") on failure.
    """
    if not wallet_address or not signature or not message:
        return False, "Missing signature material"

    # The message must reference this exact telegram_id — prevents a
    # signature signed for a different purpose/account being replayed here.
    if f"telegram_id: {expected_telegram_id}" not in message:
        return False, "Signed message does not match this Telegram account"

    # Pull the ISO timestamp out of the message and enforce freshness.
    ts_match = re.search(r'at (\d{4}-\d{2}-\d{2}T[\d:.]+Z)', message)
    if not ts_match:
        return False, "Signed message missing timestamp"
    try:
        signed_at = datetime.fromisoformat(ts_match.group(1).replace('Z', '+00:00'))
    except ValueError:
        return False, "Signed message has an invalid timestamp"

    age = datetime.now(timezone.utc) - signed_at
    if age.total_seconds() < 0:
        return False, "Signed message timestamp is in the future"
    if age.total_seconds() > max_age_minutes * 60:
        return False, "Signature has expired — please reconnect your wallet"

    # Recover the address that actually signed this message and compare it
    # (case-insensitively — checksummed vs lowercase hex) to the claimed address.
    try:
        encoded = encode_defunct(text=message)
        recovered_address = Account.recover_message(encoded, signature=signature)
    except Exception as e:
        return False, f"Could not verify signature: {str(e)}"

    if recovered_address.lower() != wallet_address.lower():
        return False, "Signature does not match the claimed wallet address"

    return True, None





# Security: Input sanitization functions
def sanitize_string(value: str, max_length: int = 100) -> str:
    """Sanitize user input strings to prevent injection attacks"""
    if not value:
        return ""
    # Remove potentially dangerous characters
    sanitized = re.sub(r'[<>"\';{}$]', '', str(value))
    # Limit length
    return sanitized[:max_length].strip()


def sanitize_address(address: str) -> str:
    """Sanitize wallet addresses"""
    if not address:
        return ""
    # Only allow alphanumeric and common address characters
    sanitized = re.sub(r'[^a-zA-Z0-9_\-]', '', str(address))
    return sanitized[:100]


def validate_nickname(nickname: str) -> str:
    """Validate and sanitize nicknames"""
    if not nickname:
        raise ValueError("Nickname cannot be empty")
    sanitized = sanitize_string(nickname, 30)
    if len(sanitized) < 2:
        raise ValueError("Nickname must be at least 2 characters")
    return sanitized


# Try to import blockcypher, with fallback to None
try:
    import blockcypher
except ImportError:
    blockcypher = None
    logging.warning("BlockCypher module not available - DOGE payment verification will use direct API calls")


# Import Phase 2 services
from services.anti_cheat import AntiCheatSystem
from services.points_system import PointsCollectionSystem
from services.merkle_tree import MerkleTreeGenerator


# Import Enhanced Game Mechanics (Phase 3)
from services.treat_game_engine import TreatGameEngine, TreatRarity
from services.ingredient_system import IngredientSystem
from services.season_manager import SeasonManager


# Firebase Configuration - MUST be set via environment variables in production
FIREBASE_API_KEY = os.environ.get("FIREBASE_API_KEY")
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "dogefood-lab")


if not FIREBASE_API_KEY:
    logging.warning("⚠️ FIREBASE_API_KEY not set - Firebase authentication will not work")


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')


# Database connection with Atlas MongoDB
# SECURITY: MONGO_URL MUST be set via environment variable
MONGO_URL = os.getenv("MONGO_URL")
if not MONGO_URL:
    logging.error("❌ CRITICAL: MONGO_URL environment variable not set!")
    raise ValueError("MONGO_URL environment variable is required")


DB_NAME = os.getenv("DB_NAME", "dogefood_lab_production")


try:
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
# SECURITY: GAME_SECRET_KEY should be set via environment variable in production
GAME_SECRET_KEY = os.environ.get('GAME_SECRET_KEY')
if not GAME_SECRET_KEY:
    logging.warning("⚠️ GAME_SECRET_KEY not set - using development key (NOT SAFE FOR PRODUCTION)")
    GAME_SECRET_KEY = 'development_key_' + os.urandom(16).hex()


# Admin secret key for protected operations - MUST be set via environment variable
ADMIN_SECRET = os.environ.get("ADMIN_SECRET")
if not ADMIN_SECRET:
    # Generate a secure random admin key if not provided (locks admin endpoints)
    ADMIN_SECRET = os.urandom(32).hex()
    logging.warning("⚠️ ADMIN_SECRET not set - generated temporary key (set env var in production)")


async def verify_admin(
    x_admin_key: Optional[str] = Header(None),
    admin_key: Optional[str] = Query(None),
):
    """Server-side admin authorization. Accepts X-Admin-Key header or admin_key query param."""
    provided = x_admin_key or admin_key
    if not provided or not hmac.compare_digest(str(provided), str(ADMIN_SECRET)):
        await asyncio.sleep(2)  # Brute force protection
        raise HTTPException(status_code=403, detail="Unauthorized: Invalid admin key")


game_engine = TreatGameEngine(GAME_SECRET_KEY)
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


@api_router.post("/admin/verify", dependencies=[Depends(verify_admin)])
async def verify_admin_key():
    """Validate an admin key server-side (used by the admin dashboard login)"""
    return {"valid": True}


# Happy Hour Configuration
HAPPY_HOUR_START_UTC = 15  # 15:00 UTC
HAPPY_HOUR_DURATION_MINUTES = 60  # 1 hour
HAPPY_HOUR_BONUS_PERCENT = 0.25  # +25% bonus points


def is_happy_hour() -> bool:
    """Check if current UTC time is during Happy Hour (15:00-16:00 UTC daily)"""
    now = datetime.now(timezone.utc)
    return now.hour == HAPPY_HOUR_START_UTC and now.minute < HAPPY_HOUR_DURATION_MINUTES


def get_happy_hour_status() -> dict:
    """Get detailed Happy Hour status with timing info"""
    now = datetime.now(timezone.utc)
    active = now.hour == HAPPY_HOUR_START_UTC and now.minute < HAPPY_HOUR_DURATION_MINUTES
    
    if active:
        # Calculate remaining time
        end_minute = HAPPY_HOUR_DURATION_MINUTES
        remaining_seconds = (end_minute - now.minute - 1) * 60 + (60 - now.second)
        return {
            "active": True,
            "bonus_percent": int(HAPPY_HOUR_BONUS_PERCENT * 100),
            "remaining_seconds": remaining_seconds,
            "message": "Happy Hour is LIVE! All treats earn +25% bonus points!",
            "start_hour_utc": HAPPY_HOUR_START_UTC,
            "duration_minutes": HAPPY_HOUR_DURATION_MINUTES
        }
    else:
        # Calculate seconds until next happy hour
        today_start = now.replace(hour=HAPPY_HOUR_START_UTC, minute=0, second=0, microsecond=0)
        if now >= today_start:
            next_start = today_start + timedelta(days=1)
        else:
            next_start = today_start
        seconds_until = int((next_start - now).total_seconds())
        return {
            "active": False,
            "bonus_percent": int(HAPPY_HOUR_BONUS_PERCENT * 100),
            "seconds_until_next": seconds_until,
            "next_start_utc": next_start.isoformat(),
            "message": f"Next Happy Hour starts at {HAPPY_HOUR_START_UTC}:00 UTC",
            "start_hour_utc": HAPPY_HOUR_START_UTC,
            "duration_minutes": HAPPY_HOUR_DURATION_MINUTES
        }




# Background task flag
background_task_started = False


# Kernel of Wow automatic selection job
async def auto_select_kernel_holder():
    """Automatically select a new Kernel of Wow holder"""
    try:
        now = datetime.now(timezone.utc)
        
        # Check if there's already an active holder
        existing_holder = await db.special_ingredient_holders.find_one({
            "is_active": True,
            "expires_at": {"$gt": now}
        })
        
        if existing_holder:
            logger.info(f"Kernel of Wow already active with {existing_holder.get('player_address')}")
            return False
        
        # Deactivate any expired holders
        await db.special_ingredient_holders.update_many(
            {"is_active": True, "expires_at": {"$lte": now}},
            {"$set": {"is_active": False}}
        )
        
        # Get active players (players who have created treats in last 7 days)
        # MUST have either a valid address OR telegram_id AND a nickname
        seven_days_ago = now - timedelta(days=7)
        
        # Query for players with valid identifiers who have been active
        # Use $nin to properly exclude both None and empty string (Python dict deduplicates $ne keys)
        active_players = await db.players.find({
            "last_active": {"$gte": seven_days_ago},
            "$or": [
                {"address": {"$exists": True, "$nin": [None, ""]}},
                {"telegram_id": {"$exists": True, "$ne": None}}
            ],
            "nickname": {"$exists": True, "$nin": [None, ""]}
        }).to_list(1000)
        
        # Fallback: get players with treats who have valid identifiers
        if not active_players:
            treat_creators = await db.treats.distinct("creator_address", {
                "created_at": {"$gte": seven_days_ago}
            })
            # Filter out None addresses
            treat_creators = [addr for addr in treat_creators if addr]
            active_players = await db.players.find({
                "address": {"$in": treat_creators},
                "nickname": {"$exists": True, "$nin": [None, ""]}
            }).to_list(1000)
        
        # Final fallback: get any players with points and valid nickname
        if not active_players:
            active_players = await db.players.find({
                "points": {"$gt": 0},
                "$or": [
                    {"address": {"$exists": True, "$nin": [None, ""]}},
                    {"telegram_id": {"$exists": True, "$ne": None}}
                ],
                "nickname": {"$exists": True, "$nin": [None, ""]}
            }).to_list(100)
        
        if not active_players:
            logger.warning("No eligible players found for Kernel of Wow")
            return False
        
        # Select random player
        selected_player = random.choice(active_players)
        
        # Get the best identifier for this player
        player_identifier = selected_player.get("address") or f"tg_{selected_player.get('telegram_id')}"
        player_nickname = selected_player.get("nickname") or selected_player.get("telegram_first_name") or "Anonymous"
        
        # Create new holder record (16 hour duration)
        expires_at = now + timedelta(hours=16)
        
        new_holder = {
            "id": str(uuid.uuid4()),
            "player_address": player_identifier,
            "player_nickname": player_nickname,
            "ingredient_id": "KERNEL_WOW",
            "granted_at": now,
            "expires_at": expires_at,
            "used_in_treats": [],
            "total_bonus_earned": 0,
            "is_active": True
        }
        
        await db.special_ingredient_holders.insert_one(new_holder)
        
        # Update player record
        if selected_player.get("address"):
            await db.players.update_one(
                {"address": selected_player.get("address")},
                {"$set": {"has_special_ingredient": True, "special_ingredient_expires": expires_at}}
            )
        elif selected_player.get("telegram_id"):
            await db.players.update_one(
                {"telegram_id": selected_player.get("telegram_id")},
                {"$set": {"has_special_ingredient": True, "special_ingredient_expires": expires_at}}
            )
        
        logger.info(f"🌟 Kernel of Wow auto-granted to {player_nickname} ({player_identifier}) until {expires_at}")
        return True
        
    except Exception as e:
        logger.error(f"Error in auto_select_kernel_holder: {e}")
        return False


async def kernel_scheduler_loop():
    """Background loop that checks every hour if a new holder needs to be selected"""
    global background_task_started
    background_task_started = True
    logger.info("🚀 Kernel of Wow scheduler loop started")
    
    while True:
        try:
            # Check and select holder if needed
            await auto_select_kernel_holder()
        except Exception as e:
            logger.error(f"Error in scheduler loop: {e}")
        
        # Sleep for 1 hour before checking again
        await asyncio.sleep(3600)


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
    is_dogeonews_holder: bool = False  # $DOGEONEWS token holder (1M+ tokens)
    solana_address: Optional[str] = None  # Linked Solana wallet for token verification
    is_vip: bool = False  # VIP Scientist badge
    vip_bonus_claimed: bool = False  # Track if 500 point bonus was claimed
    leaderboard_eligible: bool = True  # All users can appear on leaderboard
    can_convert_points: bool = False  # Only NFT holders can convert points to $LAB
    level: int = 1
    experience: int = 0
    points: int = 0
    # Season 1 snapshot (written by /admin/season2-reset)
    s1_points: Optional[int] = None
    s1_rank: Optional[int] = None
    s1_lab_tokens: Optional[int] = None
    s1_settled_at: Optional[str] = None
    # Manual admin top-up added on top of the live rank-based $LAB estimate
    # (see calc_lab_reward / get_player_lab_estimate). Deliberately NOT
    # read by get_leaderboard() or the Leaderboard page — only surfaces on
    # the live lab-estimate endpoint (MyTreats page, Lab page top bar).
    lab_bonus_allocation: int = 0
    # Ingredients won from Lab Crates — each unlocks the ingredient for the
    # player for 48 hours regardless of their level, then it expires and
    # is no longer usable. Stored as a list rather than a single value so
    # multiple crate-won ingredients can be active (with independent
    # expiry times) at once. Expired entries are filtered out on read,
    # not deleted, so the grant history remains visible if ever needed.
    temp_unlocked_ingredients: List[dict] = []
    created_treats: List[str] = []
    last_active: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
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
    is_dogeonews_holder: bool = False  # $DOGEONEWS token holder (1M+)
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


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
    listed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
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
# AUTO-MIXER SUBSCRIPTION SYSTEM
# =====================================================


# Auto-Mixer Configuration
AUTO_MIXER_CONFIG = {
    "monthly_fee_doge": 30,  # 30 DOGE per month
    "max_window_hours": 6,   # Max 6-hour mixing window
    "min_window_hours": 1,   # Min 1-hour mixing window
    "payment_address": "DMxBXyfQbkCoZJyFoKMksjn9epLTwhHAyE",  # Payment address
    "buy_burn_percent": 80,  # 80% for buy and burn
    "dev_percent": 20,       # 20% for devs
    "mixes_per_hour": 2,     # How many auto-mixes per hour during window
    "blockcypher_api_key": os.environ.get("BLOCKCYPHER_API_KEY", ""),
    "tatum_api_key": os.environ.get("TATUM_API_KEY", ""),
    "required_confirmations": 1  # Only 1 confirmation needed now with Tatum
}


# Extra Life Packages Configuration
EXTRA_LIFE_PACKAGES = {
    "basic": {
        "id": "basic",
        "name": "Basic Pack",
        "treats": 2,
        "cost_doge": 10,
        "description": "2 extra treat creations"
    },
    "standard": {
        "id": "standard",
        "name": "Standard Pack",
        "treats": 4,
        "cost_doge": 20,
        "description": "4 extra treat creations"
    },
    "premium": {
        "id": "premium",
        "name": "Premium Pack",
        "treats": 6,
        "cost_doge": 35,
        "description": "6 extra treat creations - Best Value!"
    }
}


class AutoMixerSubscription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player_address: str
    player_nickname: Optional[str] = None
    # Subscription details
    status: str = "pending"  # "pending", "active", "expired", "cancelled"
    subscription_start: Optional[datetime] = None
    subscription_end: Optional[datetime] = None
    # Mixing window (24-hour format, UTC)
    window_start_hour: int = 0  # 0-23
    window_end_hour: int = 6    # 0-23
    # Payment info
    payment_tx_hash: Optional[str] = None
    payment_amount: float = 30.0
    payment_confirmed: bool = False
    payment_confirmations: int = 0
    # Stats
    total_auto_mixes: int = 0
    last_auto_mix: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AutoMixerCreateRequest(BaseModel):
    player_address: str
    window_start_hour: int  # 0-23
    window_end_hour: int    # 0-23


class AutoMixerPaymentVerifyRequest(BaseModel):
    subscription_id: str
    tx_hash: str


class AutoMixerWindowUpdateRequest(BaseModel):
    subscription_id: str
    player_address: str
    window_start_hour: int
    window_end_hour: int


class AutoMixerFundsStats(BaseModel):
    total_received_doge: float = 0.0
    buy_burn_amount: float = 0.0
    dev_amount: float = 0.0
    total_subscribers: int = 0
    active_subscribers: int = 0
    total_auto_mixes: int = 0


# Extra Life Purchase Models
class ExtraLifeCreateRequest(BaseModel):
    player_address: str
    package_id: str  # "basic", "standard", or "premium"


class ExtraLifeVerifyRequest(BaseModel):
    purchase_id: str
    tx_hash: str


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
    # 30% bonus - Legendary combo (hardest to get) - Season 2
    "legendary": {
        "bonus_percent": 30,
        "combos": [
            {"S2_040", "S2_038", "S2_033"},  # Mythic Paw Crystals + Shiba Stardust Syrup + Titanium Taffy
            {"S2_039", "S2_034", "S2_031"},  # Royal Rocket Crunch + Omega Bacon Powder + Golden Tail Granules
        ],
        "description": "Legendary WOW Combo - Maximum boost!"
    },
    # 20% bonus - Epic combo - Season 2
    "epic": {
        "bonus_percent": 20,
        "combos": [
            {"S2_026", "S2_022"},  # Electric Biscuit Chunks + Quantum Treat Flakes
            {"S2_029", "S2_021"},  # Darkmatter Donut Crumbs + Cyber Corn Nuggets
            {"S2_030", "S2_024"},  # Stellar Steak Cubes + Astro Syrup Drops
        ],
        "description": "Epic WOW Combo - Strong boost!"
    },
    # 15% bonus - Rare combo - Season 2
    "rare": {
        "bonus_percent": 15,
        "combos": [
            {"S2_011", "S2_015"},  # Galaxy Kibble + Boneblast Seasoning
            {"S2_013", "S2_018"},  # Alpha Bacon Strips + Plasma Peanut Butter
            {"S2_017", "S2_020"},  # Shiba Spice Cubes + Doge Dust Crunch
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
    granted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
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


# ============================================================
# REFERRAL SYSTEM
# ============================================================

REFERRAL_POINTS_REFERRER = 500
REFERRAL_POINTS_NEW_PLAYER = 250
REFERRAL_MAX_PER_PLAYER = 50


class ApplyReferralRequest(BaseModel):
    new_player_address: str
    referral_code: str


def generate_referral_code(address: str) -> str:
    """Generate a deterministic short referral code from a player address."""
    hash_hex = hashlib.sha256(address.encode()).hexdigest()
    return hash_hex[:8].upper()


@api_router.get("/referral/code/{address}")
async def get_referral_code(address: str):
    """Get a player's referral code and stats."""
    address = sanitize_address(address)
    if not address:
        raise HTTPException(status_code=400, detail="Invalid address")

    player = await find_player_by_address(address)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    code = generate_referral_code(player.get("address", address))

    referral_count = await db.referrals.count_documents({
        "referrer_address": player.get("address", address),
        "status": "completed"
    })

    app_url = os.environ.get("FRONTEND_URL", "https://dogefoodlab-frontend.onrender.com")
    referral_link = f"{app_url}?ref={code}"

    return {
        "referral_code": code,
        "referral_link": referral_link,
        "referral_count": referral_count,
        "max_referrals": REFERRAL_MAX_PER_PLAYER,
        "points_per_referral": REFERRAL_POINTS_REFERRER,
        "remaining_slots": max(0, REFERRAL_MAX_PER_PLAYER - referral_count)
    }


@api_router.post("/referral/apply")
async def apply_referral(data: ApplyReferralRequest):
    """Apply a referral code when a new player joins."""
    new_address = sanitize_address(data.new_player_address)
    referral_code = sanitize_string(data.referral_code, 20).upper()

    if not new_address or not referral_code:
        raise HTTPException(status_code=400, detail="Invalid request data")

    new_player = await find_player_by_address(new_address)
    if not new_player:
        raise HTTPException(status_code=404, detail="New player not found")

    if new_player.get("referral_used"):
        raise HTTPException(status_code=400, detail="Referral code already applied to this account")

    referrer = await db.players.find_one({"referral_code": referral_code}, {"_id": 0})

    if not referrer:
        all_players = await db.players.find(
            {"address": {"$exists": True, "$nin": [None, ""]}},
            {"address": 1}
        ).to_list(10000)
        for p in all_players:
            if generate_referral_code(p["address"]) == referral_code:
                referrer = await db.players.find_one({"address": p["address"]}, {"_id": 0})
                break

    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")

    referrer_address = referrer.get("address")

    if referrer_address == new_address:
        raise HTTPException(status_code=400, detail="Cannot use your own referral code")

    referral_count = await db.referrals.count_documents({
        "referrer_address": referrer_address,
        "status": "completed"
    })
    if referral_count >= REFERRAL_MAX_PER_PLAYER:
        raise HTTPException(status_code=400, detail="Referrer has reached the maximum referral limit")

    now = datetime.now(timezone.utc)
    await db.referrals.insert_one({
        "id": str(uuid.uuid4()),
        "referrer_address": referrer_address,
        "referred_address": new_address,
        "referral_code": referral_code,
        "status": "completed",
        "created_at": now,
        "referrer_points_awarded": REFERRAL_POINTS_REFERRER,
        "referred_points_awarded": REFERRAL_POINTS_NEW_PLAYER
    })

    await db.players.update_one(
        {"address": referrer_address},
        {
            "$inc": {"points": REFERRAL_POINTS_REFERRER, "total_points_collected": REFERRAL_POINTS_REFERRER},
            "$set": {"referral_code": referral_code}
        }
    )

    new_player_address_key = new_player.get("address", new_address)
    await db.players.update_one(
        {"address": new_player_address_key},
        {
            "$inc": {"points": REFERRAL_POINTS_NEW_PLAYER, "total_points_collected": REFERRAL_POINTS_NEW_PLAYER},
            "$set": {"referral_used": True, "referred_by": referrer_address, "referred_by_code": referral_code}
        }
    )

    logger.info(f"✅ Referral applied: {referrer_address} referred {new_address} | +{REFERRAL_POINTS_REFERRER} / +{REFERRAL_POINTS_NEW_PLAYER} pts")

    return {
        "success": True,
        "message": f"Referral applied! You earned {REFERRAL_POINTS_NEW_PLAYER} bonus points!",
        "referrer_points_awarded": REFERRAL_POINTS_REFERRER,
        "new_player_points_awarded": REFERRAL_POINTS_NEW_PLAYER,
        "referrer_address": referrer_address
    }


@api_router.get("/referral/stats/{address}")
async def get_referral_stats(address: str):
    """Get full referral history for a player."""
    address = sanitize_address(address)
    player = await find_player_by_address(address)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    real_address = player.get("address", address)

    referrals = await db.referrals.find(
        {"referrer_address": real_address, "status": "completed"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    enriched = []
    for r in referrals:
        referred_player = await find_player_by_address(r["referred_address"])
        enriched.append({
            "referred_address": r["referred_address"],
            "referred_nickname": referred_player.get("nickname", "Anonymous") if referred_player else "Anonymous",
            "points_awarded": r["referrer_points_awarded"],
            "date": r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else str(r["created_at"])
        })

    return {
        "total_referrals": len(enriched),
        "total_points_earned": len(enriched) * REFERRAL_POINTS_REFERRER,
        "max_referrals": REFERRAL_MAX_PER_PLAYER,
        "remaining_slots": max(0, REFERRAL_MAX_PER_PLAYER - len(enriched)),
        "referrals": enriched
    }


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
    # Use centralised lookup so TG_/tg_ Telegram players and guest players are found
    player = await find_player_by_address(address)
    if not player and address.startswith("guest_"):
        player = await db.players.find_one({"guest_id": address}, {"_id": 0})
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
                "last_active": datetime.now(timezone.utc)
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
        # Add extra life packages info
        status["extra_life_packages"] = list(EXTRA_LIFE_PACKAGES.values())
        status["payment_address"] = AUTO_MIXER_CONFIG["payment_address"]
        return status
    except Exception as e:
        logger.error(f"Error getting daily status: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@api_router.get("/happy-hour/status")
async def happy_hour_status():
    """Get current Happy Hour status - active/upcoming with timing"""
    return get_happy_hour_status()




@api_router.get("/activity/recent")
async def get_recent_activity(limit: int = 20):
    """Get recent global activity: treat creations + spin wheel outcomes + arena rewards"""
    try:
        now = datetime.now(timezone.utc)

        # ── 1. Treat creations (sorted by created_at as before) ──────────
        treat_pipeline = [
            {"$sort": {"created_at": -1}},
            {"$limit": limit},
            {"$lookup": {
                "from": "players",
                "localField": "creator_address",
                "foreignField": "address",
                "as": "player_info"
            }},
            {"$unwind": {"path": "$player_info", "preserveNullAndEmptyArrays": True}},
            {"$project": {
                "_id": 0,
                "activity_type": {"$literal": "treat"},
                "type": {"$literal": "treat"},
                "treat_name": "$name",
                "rarity": 1,
                "points_reward": {"$ifNull": ["$points_reward", 0]},
                "xp_reward": {"$ifNull": ["$xp_reward", 0]},
                "player_nickname": {"$ifNull": ["$player_info.nickname", "Anonymous"]},
                "player_address": "$creator_address",
                "created_at": 1,
                "emoji": 1,
            }}
        ]
        treat_events = await db.treats.aggregate(treat_pipeline).to_list(limit)

        # ── 2. Spin wheel + arena events from activity_feed ───────────────
        # Only show events from the last 48 hours to prevent old arena
        # settlement cycles accumulating and flooding the feed.
        cutoff_48h = (now - timedelta(hours=48)).isoformat()
        feed_events = await db.activity_feed.find(
            {"created_at": {"$gte": cutoff_48h}}, {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)

        # ── 3. Merge, sort by created_at desc, take top `limit` ───────────
        all_events = treat_events + feed_events

        def _parse_dt(val):
            if val is None:
                return datetime.min.replace(tzinfo=timezone.utc)
            if hasattr(val, 'timestamp'):
                return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
            try:
                return datetime.fromisoformat(str(val).replace("Z", "+00:00"))
            except Exception:
                return datetime.min.replace(tzinfo=timezone.utc)

        all_events.sort(key=lambda e: _parse_dt(e.get("created_at")), reverse=True)
        all_events = all_events[:limit]

        # ── 4. Normalise created_at → ISO string ──────────────────────────
        for e in all_events:
            if e.get("created_at"):
                dt = e["created_at"]
                if hasattr(dt, 'isoformat'):
                    iso = dt.isoformat()
                    if '+' not in iso and not iso.endswith('Z'):
                        iso += 'Z'
                    e["created_at"] = iso
                else:
                    e["created_at"] = str(e["created_at"])

        return {"activity": all_events}
    except Exception as e:
        logger.error(f"Error fetching recent activity: {e}")
        return {"activity": []}




# ─── Live Chat Endpoints ──────────────────────────────────────


@api_router.get("/chat/messages")
async def get_chat_messages(limit: int = 50):
    """Get recent chat messages for the live feed"""
    try:
        # Simple find with sort — NO $lookup needed, nicknames are stored in messages
        messages = await db.chat_messages.find(
            {},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        for m in messages:
            if m.get("created_at"):
                dt = m["created_at"]
                if hasattr(dt, 'isoformat'):
                    iso = dt.isoformat()
                    if '+' not in iso and not iso.endswith('Z'):
                        iso += 'Z'
                    m["created_at"] = iso
                else:
                    m["created_at"] = str(dt)
            # Normalize nickname field for frontend
            if not m.get("player_nickname"):
                m["player_nickname"] = m.get("sender_nickname") or m.get("nickname") or "Player"
        
        messages.reverse()
        return {"messages": messages}
    except Exception as e:
        logger.error(f"Error fetching chat messages: {e}")
        return {"messages": []}




@api_router.post("/chat/send")
async def send_chat_message(data: dict):
    """Send a chat message (registered players only)"""
    try:
        player_id = data.get("player_id")
        message = data.get("message", "").strip()
        reply_to = data.get("reply_to")
        reply_nickname = data.get("reply_nickname")
        reply_text = data.get("reply_text")


        if not player_id or not message:
            raise HTTPException(status_code=400, detail="player_id and message required")
        if len(message) > 500:
            raise HTTPException(status_code=400, detail="Message too long (max 500 chars)")


        player = await db.players.find_one({"address": player_id}, {"_id": 0, "nickname": 1, "profile_image": 1})
        if not player:
            raise HTTPException(status_code=404, detail="Player not found")


        emoji_chars = set('😀😁😂🤣😃😄😅😆😉😊😋😎😍😘🥰😗😙🥲😚☺😌😛😝😜🤪🤨🧐🤓😎🥳🤩😏😒😞😔😟😕🙁☹😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🫣🤗🫡🤔🫢🤭🤫🤥😶😐😑😬🫠🫨🙄😯😦😧😮😲🥱😴🤤😪😵🫥🤐🥴🤢🤮🤧😷🤒🤕🤑🤠😈👿👹👺🤡💩👻💀☠👽👾🤖🎃😺😸😹😻😼😽🙀😿😾🫶🤲👐🙌👏🤝👍👎👊✊🤛🤜🤞✌🫰🤟🤘👌🤌🤏👈👉👆🖕👇☝🫵👋🤚🖐✋🖖🫳🫴👊👏🔥❤💛💚💙💜🖤🤍🤎💔❣💕💞💓💗💖💘💝🏆🎯🎮🎲🎰🎪🎨🎭🎬🎤🎧🎼🎵🎶🐕🐶🐩🦮🐕‍🦺🐾💎✨🌟⭐💫🎉🎊🪄')
        is_emoji_only = all(c in emoji_chars or c == ' ' for c in message)


        doc = {
            "player_id": player_id,
            "nickname": player.get("nickname", "Anonymous"),
            "message": message,
            "emoji_only": is_emoji_only,
            "created_at": datetime.now(timezone.utc)
        }
        if reply_to:
            doc["reply_to"] = reply_to
        if reply_nickname:
            doc["reply_nickname"] = reply_nickname
        if reply_text:
            doc["reply_text"] = reply_text[:100]


        result = await db.chat_messages.insert_one(doc)


        return {
            "success": True,
            "message_id": str(result.inserted_id),
            "player_nickname": player.get("nickname", "Anonymous"),
            "player_image": player.get("profile_image"),
            "message": message,
            "emoji_only": is_emoji_only,
            "created_at": doc["created_at"].isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending chat message: {e}")
        raise HTTPException(status_code=500, detail="Failed to send message")




@api_router.get("/extra-life/packages")
async def get_extra_life_packages():
    """Get available extra life packages with DOGE pricing"""
    return {
        "packages": list(EXTRA_LIFE_PACKAGES.values()),
        "payment_address": AUTO_MIXER_CONFIG["payment_address"],
        "required_confirmations": AUTO_MIXER_CONFIG["required_confirmations"]
    }


@api_router.post("/extra-life/create")
async def create_extra_life_purchase(request: ExtraLifeCreateRequest):
    """Create a new extra life purchase (pending payment)"""
    try:
        # Validate package
        if request.package_id not in EXTRA_LIFE_PACKAGES:
            raise HTTPException(status_code=400, detail="Invalid package ID")
        
        package = EXTRA_LIFE_PACKAGES[request.package_id]
        
        # Check for existing pending purchase for this player
        existing = await db.extra_life_purchases.find_one({
            "player_address": request.player_address,
            "status": "pending"
        })
        
        if existing:
            return {
                "purchase": {k: v for k, v in existing.items() if k != "_id"},
                "existing": True,
                "payment_address": AUTO_MIXER_CONFIG["payment_address"]
            }
        
        # Generate unique payment amount to avoid collisions between orders
        # Add a small random offset (0.001 - 0.099) to the base price
        unique_offset = round(random.randint(1, 99) / 1000, 3)
        unique_amount = round(package["cost_doge"] + unique_offset, 3)
        
        # Ensure no other pending order has the same unique amount
        while await db.extra_life_purchases.find_one({"unique_amount": unique_amount, "status": "pending"}):
            unique_offset = round(random.randint(1, 99) / 1000, 3)
            unique_amount = round(package["cost_doge"] + unique_offset, 3)
        
        # Create new purchase record
        purchase_id = str(uuid.uuid4())
        purchase = {
            "id": purchase_id,
            "player_address": request.player_address,
            "package_id": request.package_id,
            "package_name": package["name"],
            "treats_amount": package["treats"],
            "cost_doge": package["cost_doge"],
            "unique_amount": unique_amount,
            "status": "pending",
            "payment_tx_hash": None,
            "payment_confirmed": False,
            "payment_confirmations": 0,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.extra_life_purchases.insert_one(purchase)
        
        # After creating a new order, check if any unmatched payments can now be matched
        try:
            # Look for unmatched payments close to the unique amount
            unmatched_cursor = db.processed_payments.find(
                {"matched_order_type": "unmatched", "amount": {"$gt": 0}}
            )
            async for unmatched in unmatched_cursor:
                if abs(unmatched["amount"] - unique_amount) <= 0.0005:
                    activated = await match_and_activate_payment(
                        unmatched["tx_hash"], unmatched["amount"], unmatched.get("confirmations", 1)
                    )
                    if activated:
                        await db.processed_payments.update_one(
                            {"tx_hash": unmatched["tx_hash"]},
                            {"$set": {
                                "matched_order_type": activated.get("type"),
                                "matched_order_id": activated.get("order_id"),
                                "player_address": activated.get("player_address"),
                                "rematched_at": datetime.now(timezone.utc)
                            }}
                        )
                        logger.info(f"Auto-matched existing payment to new order for {request.player_address}")
                        updated = await db.extra_life_purchases.find_one({"id": purchase_id})
                        if updated:
                            return {
                                "purchase": {k: v for k, v in updated.items() if k != "_id"},
                                "existing": False,
                                "payment_address": AUTO_MIXER_CONFIG["payment_address"],
                                "auto_matched": True
                            }
                        break
        except Exception as recheck_err:
            logger.warning(f"Recheck of unmatched payments failed (non-critical): {recheck_err}")
        
        return {
            "purchase": {k: v for k, v in purchase.items() if k != "_id"},
            "existing": False,
            "payment_address": AUTO_MIXER_CONFIG["payment_address"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating extra life purchase: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/extra-life/verify-payment")
async def verify_extra_life_payment(request: ExtraLifeVerifyRequest):
    """Verify payment for extra life purchase"""
    try:
        # Find the purchase
        purchase = await db.extra_life_purchases.find_one({
            "id": request.purchase_id,
            "status": "pending"
        })
        
        if not purchase:
            raise HTTPException(status_code=404, detail="Purchase not found or already processed")
        
        # Use cost_doge as the floor — any amount >= cost_doge is valid.
        # The unique_amount is only for auto-detection matching, not for rejecting valid payments.
        expected_amount = purchase["cost_doge"]
        
        # Use the existing DOGE verification function
        # Returns tuple: (tx_data, confirmations, payment_amount, error)
        tx_data, confirmations, payment_amount, error = await verify_doge_transaction_with_fallback(
            request.tx_hash,
            AUTO_MIXER_CONFIG["payment_address"],
            AUTO_MIXER_CONFIG.get("blockcypher_api_key")
        )
        
        if error is not None:
            return {
                "success": False,
                "message": f"Transaction not found. {error}",
                "purchase": {k: v for k, v in purchase.items() if k != "_id"}
            }
        
        # Update purchase with payment info
        now = datetime.now(timezone.utc)
        update_data = {
            "payment_tx_hash": request.tx_hash,
            "payment_confirmations": confirmations,
            "updated_at": now
        }
        
        is_confirmed = confirmations >= AUTO_MIXER_CONFIG["required_confirmations"]
        # Accept if payment_amount is within 0.05 of cost_doge (handles wallet rounding)
        # or if payment_amount exactly matches the unique_amount shown to the player
        unique_amount = purchase.get("unique_amount", expected_amount)
        amount_valid = (payment_amount >= expected_amount - 0.05) or (abs(payment_amount - unique_amount) <= 0.05)
        
        if is_confirmed and amount_valid:
            update_data["status"] = "completed"
            update_data["payment_confirmed"] = True
            update_data["completed_at"] = now
            
            # Grant extra treats to the player
            treats_to_grant = purchase["treats_amount"]
            await db.players.update_one(
                {"address": purchase["player_address"]},
                {
                    "$inc": {"extra_treats_balance": treats_to_grant},
                    "$push": {
                        "extra_life_history": {
                            "purchase_id": request.purchase_id,
                            "package_id": purchase["package_id"],
                            "treats_granted": treats_to_grant,
                            "cost_doge": purchase["cost_doge"],
                            "tx_hash": request.tx_hash,
                            "granted_at": now
                        }
                    }
                },
                upsert=True
            )
            
            logger.info(f"Extra life granted: {treats_to_grant} treats to {purchase['player_address']}")
        
        await db.extra_life_purchases.update_one(
            {"id": request.purchase_id},
            {"$set": update_data}
        )
        
        # Get updated purchase
        updated_purchase = await db.extra_life_purchases.find_one({"id": request.purchase_id})
        
        return {
            "success": is_confirmed and amount_valid,
            "is_confirmed": is_confirmed,
            "amount_valid": amount_valid,
            "confirmations": confirmations,
            "required_confirmations": AUTO_MIXER_CONFIG["required_confirmations"],
            "amount_received": payment_amount,
            "expected_amount": expected_amount,
            "message": "Payment verified! Extra treats added to your account." if (is_confirmed and amount_valid) else f"Payment found with {confirmations} confirmations. Need {AUTO_MIXER_CONFIG['required_confirmations']}.",
            "purchase": {k: v for k, v in updated_purchase.items() if k != "_id"} if updated_purchase else None
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying extra life payment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/extra-life/status/{player_address}")
async def get_extra_life_status(player_address: str):
    """Get player's extra life purchase status and balance"""
    try:
        # Get pending purchase if any
        pending_purchase = await db.extra_life_purchases.find_one({
            "player_address": player_address,
            "status": "pending"
        })
        
        # Get player's extra treats balance
        player = await db.players.find_one({"address": player_address})
        extra_treats_balance = player.get("extra_treats_balance", 0) if player else 0
        
        # Get purchase history
        history = await db.extra_life_purchases.find({
            "player_address": player_address,
            "status": "completed"
        }).sort("completed_at", -1).limit(10).to_list(10)
        
        return {
            "extra_treats_balance": extra_treats_balance,
            "pending_purchase": {k: v for k, v in pending_purchase.items() if k != "_id"} if pending_purchase else None,
            "purchase_history": [{k: v for k, v in p.items() if k != "_id"} for p in history],
            "packages": list(EXTRA_LIFE_PACKAGES.values()),
            "payment_address": AUTO_MIXER_CONFIG["payment_address"]
        }
    except Exception as e:
        logger.error(f"Error getting extra life status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/extra-life/cancel/{purchase_id}")
async def cancel_extra_life_purchase(purchase_id: str, player_address: str):
    """Cancel a pending extra life purchase"""
    try:
        result = await db.extra_life_purchases.delete_one({
            "id": purchase_id,
            "player_address": player_address,
            "status": "pending"
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Purchase not found or cannot be cancelled")
        
        return {"success": True, "message": "Purchase cancelled"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling extra life purchase: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        
        # Use MongoDB aggregation for stats instead of loading all treats into memory
        stats_pipeline = [
            {"$match": {"creator_address": address, "created_at": {"$gte": seven_days_ago}}},
            {"$group": {
                "_id": "$rarity",
                "count": {"$sum": 1},
                "total_points": {"$sum": {"$ifNull": ["$points_reward", 0]}},
                "total_xp": {"$sum": {"$ifNull": ["$xp_reward", 0]}}
            }}
        ]
        rarity_results = await db.treats.aggregate(stats_pipeline).to_list(10)
        
        rarity_counts = {"Starter": 0, "Common": 0, "Uncommon": 0, "Rare": 0, "Epic": 0, "Legendary": 0, "Mythic": 0}
        total_treats = 0
        total_points = 0
        total_xp = 0
        for r in rarity_results:
            rarity = r.get("_id", "Common")
            if rarity in rarity_counts:
                rarity_counts[rarity] = r["count"]
            total_treats += r["count"]
            total_points += r.get("total_points", 0)
            total_xp += r.get("total_xp", 0)
        
        # Get unique formulas count via aggregation
        formula_count = await db.treats.count_documents({
            "creator_address": address,
            "created_at": {"$gte": seven_days_ago}
        })
        
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
        
        # Get daily breakdown via aggregation
        daily_pipeline = [
            {"$match": {"creator_address": address, "created_at": {"$gte": seven_days_ago}}},
            {"$project": {
                "day": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "points_reward": {"$ifNull": ["$points_reward", 0]},
                "xp_reward": {"$ifNull": ["$xp_reward", 0]}
            }},
            {"$group": {
                "_id": "$day",
                "treats": {"$sum": 1},
                "points": {"$sum": "$points_reward"},
                "xp": {"$sum": "$xp_reward"}
            }}
        ]
        daily_results = await db.treats.aggregate(daily_pipeline).to_list(10)
        
        daily_stats = {}
        now = datetime.now(timezone.utc)
        for i in range(7):
            day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            daily_stats[day] = {"treats": 0, "points": 0, "xp": 0}
        
        for dr in daily_results:
            day = dr.get("_id")
            if day and day in daily_stats:
                daily_stats[day] = {"treats": dr["treats"], "points": dr["points"], "xp": dr["xp"]}
        
        # Calculate averages
        avg_treats_per_day = total_treats / 7 if total_treats > 0 else 0
        avg_points_per_day = total_points / 7 if total_points > 0 else 0
        
        # Get player rank — only count players who have created treats
        leaderboard_cursor = db.players.find(
            {
                "total_treats_created": {"$gt": 0},
                "nickname": {"$exists": True, "$nin": [None, ""]}
            },
            {"address": 1, "points": 1}
        ).sort("points", -1).limit(50)
        leaderboard_list = await leaderboard_cursor.to_list(50)
        
        player_rank = None
        total_players = len(leaderboard_list)
        for idx, lb_player in enumerate(leaderboard_list):
            if lb_player.get("address", "").lower() == address.lower():
                player_rank = idx + 1
                break
        
        # ── Arena & bonus activity ───────────────────────────────────
        # Participation = arena entries the player has ever joined.
        # Wins = settled arena sessions where this player finished #1.
        arena_participations = await db.arena_entries.count_documents({"player_address": address})
        arena_wins = await db.arena_sessions.count_documents({"status": "settled", "winner_address": address})
        arena_losses = max(arena_participations - arena_wins, 0)
        arena_win_rate = round((arena_wins / arena_participations) * 100) if arena_participations > 0 else 0

        # Total arena reward points earned across all settled sessions.
        arena_points_earned = 0
        try:
            arena_reward_pipeline = [
                {"$match": {"status": "settled", "final_rewards.address": address}},
                {"$unwind": "$final_rewards"},
                {"$match": {"final_rewards.address": address}},
                {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$final_rewards.points", 0]}}}}
            ]
            arena_reward_res = await db.arena_sessions.aggregate(arena_reward_pipeline).to_list(1)
            if arena_reward_res:
                arena_points_earned = arena_reward_res[0].get("total", 0)
        except Exception:
            arena_points_earned = 0

        # Kernel-of-Wow bonus points earned (special ingredient holder records).
        kernel_bonus_total = 0
        try:
            bonus_pipeline = [
                {"$match": {"player_address": address}},
                {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$total_bonus_earned", 0]}}}}
            ]
            bonus_res = await db.special_ingredient_holders.aggregate(bonus_pipeline).to_list(1)
            if bonus_res:
                kernel_bonus_total = bonus_res[0].get("total", 0)
        except Exception:
            kernel_bonus_total = 0

        vip_bonus = 500 if player.get("vip_bonus_claimed") else 0

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
            "period_end": datetime.now(timezone.utc).isoformat(),
            "stats": {
                "treats_created": total_treats,
                "points_earned": total_points,
                "xp_gained": total_xp,
                "unique_formulas": formula_count,
                "best_rarity": best_rarity,
                "avg_treats_per_day": round(avg_treats_per_day, 1),
                "avg_points_per_day": round(avg_points_per_day, 1)
            },
            "rarity_breakdown": rarity_counts,
            "arena": {
                "participations": arena_participations,
                "wins": arena_wins,
                "losses": arena_losses,
                "win_rate": arena_win_rate,
                "points_earned": arena_points_earned
            },
            "bonuses": {
                "kernel_bonus_total": kernel_bonus_total,
                "vip_bonus": vip_bonus,
                "total": kernel_bonus_total + vip_bonus
            },
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
        ready_at = datetime.now(timezone.utc) + timedelta(seconds=treat_data.timer_duration)
    
    treat = DogeTreat(
        **treat_data.dict(),
        ready_at=ready_at
    )
    
    # Add treat to database
    await db.treats.insert_one(treat.dict())
    
    # Add treat ID to player's created_treats list. Defensive: if no player
    # document exists yet for this address (e.g. registration hasn't landed
    # yet, or predates the auto-registration fix), create a minimal one now
    # instead of letting this update_one silently no-op — without a player
    # doc, the later /collect call has nothing to credit points/XP to and
    # the player can never appear on the leaderboard (which requires a
    # nickname). A bare $push with no upsert here was the original bug.
    existing_player = await find_player_by_address(treat_data.creator_address)
    if existing_player:
        await db.players.update_one(
            {"id": existing_player["id"]},
            {"$push": {"created_treats": treat.id}}
        )
    elif treat_data.creator_address and not treat_data.creator_address.startswith("guest_") and treat_data.creator_address != "GUEST_USER":
        short_addr = treat_data.creator_address[:6] + treat_data.creator_address[-4:] if len(treat_data.creator_address) > 10 else treat_data.creator_address
        await db.players.insert_one({
            "id": str(uuid.uuid4()),
            "address": treat_data.creator_address,
            "nickname": f"Scientist {short_addr}",
            "created_treats": [treat.id],
            "last_active": datetime.now(timezone.utc).isoformat(),
        })
        logger.warning(f"Created missing player doc on first treat for {treat_data.creator_address} (registration should have created this already)")
    
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
    # Validate username (3-20 chars, alphanumeric and underscores only)
    import re
    if not re.match(r'^[a-zA-Z0-9_]{3,20}$', username):
        raise HTTPException(status_code=400, detail="Username must be 3-20 characters, alphanumeric and underscores only")

    # Resolve the real player document (handles TG_/tg_ case + telegram_id fallback)
    player = await find_player_by_address(address)
    if not player and address.startswith("guest_"):
        player = await db.players.find_one({"guest_id": address}, {"_id": 0})

    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Check if username is already taken by a *different* player document
    existing = await db.players.find_one({"nickname": username, "id": {"$ne": player.get("id")}})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    result = await db.players.update_one(
        {"id": player.get("id")},
        {"$set": {"nickname": username}}
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

    # Resolve the real player document (handles TG_/tg_ case + telegram_id fallback)
    player = await find_player_by_address(address)
    if not player and address.startswith("guest_"):
        player = await db.players.find_one({"guest_id": address}, {"_id": 0})

    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Check if player already has a character selected
    if player.get("selected_character"):
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
        {"id": player.get("id")},
        {
            "$set": {
                "selected_character": character_id,
                "character_bonuses": character_bonuses.get(character_id, {})
            }
        }
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
    player = None
    
    # Use centralized lookup (handles TG_/tg_ case, telegram_id, guest)
    if address.lower().startswith("tg_") or not address.startswith("guest_"):
        player = await find_player_by_address(address)
    
    if not player and address.startswith("guest_"):
        player = await db.players.find_one({"guest_id": address}, {"_id": 0})
    
    if not player:
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

    # Always return points/level as numbers so the frontend never gets null
    return {
        **player,
        "points": int(player.get("points") or 0),
        "level":  int(player.get("level")  or 1),
        "nickname": player.get("nickname") or player.get("telegram_first_name") or player.get("telegram_username") or None,
        "profile_image": player.get("profile_image") or None,
    }


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

        # Resolve the real player document (handles TG_/tg_ case + telegram_id fallback)
        player = await find_player_by_address(address)
        if not player and address.startswith("guest_"):
            player = await db.players.find_one({"guest_id": address}, {"_id": 0})

        if player:
            await db.players.update_one(
                {"id": player.get("id")},
                {"$set": {"profile_image": image_data, "last_active": datetime.now(timezone.utc).isoformat()}}
            )
        else:
            # No existing player matched at all — create a new wallet-style record.
            # (Telegram/guest players should already exist via registration, so this
            # path is effectively wallet-only.)
            await db.players.insert_one({
                "id": str(uuid.uuid4()),
                "address": address,
                "profile_image": image_data,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_active": datetime.now(timezone.utc).isoformat()
            })
        
        return {"success": True, "message": "Profile image updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile image: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/admin/credit-nft-holders", dependencies=[Depends(verify_admin)])
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


@api_router.post("/admin/credit-nft-holder/{address}", dependencies=[Depends(verify_admin)])
async def credit_single_nft_holder(address: str):
    """
    Admin endpoint to manually credit a specific NFT holder with VIP bonus.
    Use this for players who should have received the bonus but didn't.
    """
    try:
        # Find the player
        player = await db.players.find_one({"address": address})
        
        if not player:
            # Create new VIP player
            new_player = {
                "id": str(uuid.uuid4()),
                "address": address,
                "nickname": None,
                "is_nft_holder": True,
                "is_vip": True,
                "vip_bonus_claimed": True,
                "points": 500,
                "level": 1,
                "experience": 0,
                "created_treats": [],
                "last_active": datetime.now(timezone.utc),
                "leaderboard_eligible": True,
                "can_convert_points": True
            }
            await db.players.insert_one(new_player)
            logger.info(f"🌟 Created new VIP player with bonus: {address}")
            return {
                "success": True,
                "address": address,
                "action": "created_new_player",
                "points_credited": 500,
                "is_vip": True
            }
        
        # Player exists
        current_points = player.get("points", 0)
        already_claimed = player.get("vip_bonus_claimed", False)
        
        if already_claimed:
            # Just ensure VIP status is set
            await db.players.update_one(
                {"address": address},
                {"$set": {"is_nft_holder": True, "is_vip": True}}
            )
            return {
                "success": True,
                "address": address,
                "action": "already_credited",
                "message": "Player already received VIP bonus",
                "current_points": current_points,
                "is_vip": True
            }
        
        # Credit the bonus
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
        
        logger.info(f"🌟 Manually credited VIP bonus to {address}: {current_points} -> {current_points + 500}")
        
        return {
            "success": True,
            "address": address,
            "action": "credited",
            "old_points": current_points,
            "new_points": current_points + 500,
            "points_credited": 500,
            "is_vip": True
        }
        
    except Exception as e:
        logger.error(f"Error crediting NFT holder {address}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/admin/remove-test-users", dependencies=[Depends(verify_admin)])
async def remove_test_users():
    """
    Admin endpoint to remove all test users from the database.
    Removes players with addresses containing 'test', '0xTest', or 'test_' prefix.
    """
    try:
        # Find test users
        test_users = await db.players.find({
            "$or": [
                {"address": {"$regex": "test", "$options": "i"}},
                {"address": {"$regex": "^0xTest", "$options": "i"}},
                {"address": {"$regex": "^test_", "$options": "i"}},
                {"nickname": {"$regex": "^test", "$options": "i"}}
            ]
        }).to_list(1000)
        
        removed_users = []
        for user in test_users:
            address = user.get("address")
            nickname = user.get("nickname")
            points = user.get("points", 0)
            
            # Remove the player
            await db.players.delete_one({"address": address})
            
            # Also remove their treats
            await db.treats.delete_many({"creator_address": address})
            
            # Remove from auto-mixer subscriptions
            await db.auto_mixer_subscriptions.delete_many({"player_address": address})
            
            removed_users.append({
                "address": address,
                "nickname": nickname,
                "points": points
            })
            logger.info(f"🗑️ Removed test user: {address} ({nickname})")
        
        return {
            "success": True,
            "message": f"Removed {len(removed_users)} test users",
            "removed_count": len(removed_users),
            "removed_users": removed_users
        }
        
    except Exception as e:
        logger.error(f"Error removing test users: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/admin/remove-placeholder-accounts", dependencies=[Depends(verify_admin)])
async def remove_placeholder_accounts():
    """
    Admin endpoint to remove placeholder accounts - players who were created
    but never actually signed up (no selected_character).
    Only removes accounts with 500 or fewer points (just the signup bonus).
    """
    try:
        # Use count + targeted queries instead of loading all documents into memory
        placeholder_count = await db.players.count_documents({
            "$or": [
                {"selected_character": {"$exists": False}},
                {"selected_character": None}
            ],
            "points": {"$lte": 500}
        })
        
        # Delete in batches to avoid memory issues
        removed = []
        batch_size = 100
        
        for _ in range(0, placeholder_count, batch_size):
            batch = await db.players.find({
                "$or": [
                    {"selected_character": {"$exists": False}},
                    {"selected_character": None}
                ],
                "points": {"$lte": 500}
            }, {"_id": 1, "address": 1, "nickname": 1, "points": 1}).limit(batch_size).to_list(batch_size)
            
            if not batch:
                break
            
            ids_to_delete = [p["_id"] for p in batch]
            for p in batch:
                removed.append({
                    "address": p.get("address"),
                    "nickname": p.get("nickname"),
                    "points": p.get("points", 0)
                })
            
            await db.players.delete_many({"_id": {"$in": ids_to_delete}})
        
        return {
            "success": True,
            "message": f"Removed {len(removed)} placeholder accounts",
            "removed_count": len(removed),
            "removed_accounts": removed[:50]
        }
        
    except Exception as e:
        logger.error(f"Error removing placeholder accounts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/check-nft-holders", dependencies=[Depends(verify_admin)])
async def check_nft_holders_status():
    """
    Admin endpoint to check which players have DogeFood NFT but don't have VIP status.
    Returns list of players who need to be credited.
    """
    try:
        # Use targeted count queries instead of loading all players into memory
        total_count, vip_count, uncredited_count = await asyncio.gather(
            db.players.count_documents({}),
            db.players.count_documents({"$or": [{"is_nft_holder": True}, {"is_vip": True}]}),
            db.players.count_documents({"is_nft_holder": True, "vip_bonus_claimed": {"$ne": True}})
        )
        
        # Only fetch the uncredited details (small set)
        uncredited_vip = await db.players.find(
            {"is_nft_holder": True, "vip_bonus_claimed": {"$ne": True}},
            {"_id": 0, "address": 1, "nickname": 1, "points": 1}
        ).to_list(100)
        
        return {
            "total_players": total_count,
            "vip_players": vip_count,
            "non_vip_players": total_count - vip_count,
            "uncredited_vip_count": uncredited_count,
            "uncredited_vip": uncredited_vip,
            "nft_contract": DOGEFOOD_NFT_CONTRACT,
            "network": "DogeOS Testnet",
            "blockscout_url": DOGEOS_BLOCKSCOUT_URL,
            "note": "Use /admin/verify-nft-blockchain/{address} to check if a specific address holds the NFT on DogeOS"
        }
        
    except Exception as e:
        logger.error(f"Error checking NFT holders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/admin/verify-nft-blockchain/{address}", dependencies=[Depends(verify_admin)])
async def verify_nft_on_blockchain(address: str):
    """
    Admin endpoint to verify NFT ownership directly on DogeOS blockchain using Blockscout API.
    If holder, credits VIP bonus.
    """
    try:
        # Use DogeOS Blockscout API to check NFT balance
        url = f"{DOGEOS_BLOCKSCOUT_URL}/api?module=account&action=tokenbalance&contractaddress={DOGEFOOD_NFT_CONTRACT}&address={address}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=30.0)
            data = response.json()
        
        # Check NFT balance
        is_holder = False
        nft_count = 0
        
        if data.get("status") == "1" and data.get("result"):
            try:
                nft_count = int(data.get("result", "0"))
                is_holder = nft_count > 0
            except (ValueError, TypeError):
                nft_count = 0
                is_holder = False
        
        if is_holder:
            # Credit the player
            player = await db.players.find_one({"address": address})
            
            if player:
                if not player.get("vip_bonus_claimed"):
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
                    logger.info(f"🌟 DogeOS verified & credited: {address}")
                    return {
                        "address": address,
                        "is_holder": True,
                        "nft_count": nft_count,
                        "action": "credited",
                        "bonus_points": 500,
                        "contract": DOGEFOOD_NFT_CONTRACT,
                        "network": "DogeOS Testnet"
                    }
                else:
                    await db.players.update_one(
                        {"address": address},
                        {"$set": {"is_nft_holder": True, "is_vip": True}}
                    )
                    return {
                        "address": address,
                        "is_holder": True,
                        "nft_count": nft_count,
                        "action": "already_credited",
                        "contract": DOGEFOOD_NFT_CONTRACT,
                        "network": "DogeOS Testnet"
                    }
            else:
                # Create new VIP player
                new_player = {
                    "id": str(uuid.uuid4()),
                    "address": address,
                    "nickname": None,
                    "is_nft_holder": True,
                    "is_vip": True,
                    "vip_bonus_claimed": True,
                    "points": 500,
                    "level": 1,
                    "experience": 0,
                    "created_treats": [],
                    "last_active": datetime.now(timezone.utc),
                    "leaderboard_eligible": True
                }
                await db.players.insert_one(new_player)
                return {
                    "address": address,
                    "is_holder": True,
                    "nft_count": nft_count,
                    "action": "created_new_vip",
                    "bonus_points": 500,
                    "contract": DOGEFOOD_NFT_CONTRACT,
                    "network": "DogeOS Testnet"
                }
        
        return {
            "address": address,
            "is_holder": False,
            "nft_count": 0,
            "contract": DOGEFOOD_NFT_CONTRACT,
            "network": "DogeOS Testnet",
            "message": "Address does not hold DogeFood NFT"
        }
        
    except Exception as e:
        logger.error(f"Error verifying NFT on DogeOS: {e}")
        raise HTTPException(status_code=500, detail=str(e))




@api_router.post("/admin/verify-all-nft-holders", dependencies=[Depends(verify_admin)])
async def verify_all_nft_holders_blockchain():
    """
    Batch-verify ALL wallet-based players against the DogeOS blockchain.
    Finds players who hold the NFT but are not marked as holders,
    credits them with VIP bonus, and also checks if any marked holders
    no longer hold the NFT.
    """
    try:
        # Get all wallet-based players (0x addresses) - use projection to minimize memory
        all_wallet_players = await db.players.find(
            {"address": {"$regex": "^0x", "$options": "i"}},
            {"address": 1, "is_nft_holder": 1, "is_vip": 1, "vip_bonus_claimed": 1, "points": 1, "nickname": 1, "_id": 0}
        ).to_list(200)
        
        results = {
            "total_checked": len(all_wallet_players),
            "newly_credited": [],
            "already_credited": [],
            "not_holders": [],
            "errors": []
        }
        
        async with httpx.AsyncClient() as client:
            for player in all_wallet_players:
                address = player.get("address")
                try:
                    url = f"{DOGEOS_BLOCKSCOUT_URL}/api?module=account&action=tokenbalance&contractaddress={DOGEFOOD_NFT_CONTRACT}&address={address}"
                    response = await client.get(url, timeout=15.0)
                    data = response.json()
                    
                    nft_count = 0
                    if data.get("status") == "1" and data.get("result"):
                        try:
                            nft_count = int(data.get("result", "0"))
                        except (ValueError, TypeError):
                            nft_count = 0
                    
                    is_holder = nft_count > 0
                    
                    if is_holder:
                        if not player.get("vip_bonus_claimed", False):
                            # NFT holder who hasn't received bonus yet
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
                            results["newly_credited"].append({
                                "address": address,
                                "nickname": player.get("nickname"),
                                "nft_count": nft_count,
                                "old_points": player.get("points", 0),
                                "new_points": player.get("points", 0) + 500
                            })
                            logger.info(f"NFT batch verify: Credited {address} with 500 bonus points")
                        else:
                            # Already credited — ensure flags are correct
                            await db.players.update_one(
                                {"address": address},
                                {"$set": {"is_nft_holder": True, "is_vip": True}}
                            )
                            results["already_credited"].append(address)
                    else:
                        results["not_holders"].append(address)
                    
                    # Rate limit: small delay between requests
                    await asyncio.sleep(0.2)
                    
                except Exception as e:
                    results["errors"].append({"address": address, "error": str(e)})
                    logger.error(f"NFT batch verify error for {address}: {e}")
        
        return {
            "success": True,
            "total_checked": results["total_checked"],
            "newly_credited_count": len(results["newly_credited"]),
            "newly_credited": results["newly_credited"],
            "already_credited_count": len(results["already_credited"]),
            "not_holder_count": len(results["not_holders"]),
            "error_count": len(results["errors"]),
            "errors": results["errors"]
        }
        
    except Exception as e:
        logger.error(f"Error in batch NFT verification: {e}")
        raise HTTPException(status_code=500, detail=str(e))






# $DOGEONEWS Token Configuration (Solana)
DOGEONEWS_TOKEN_ADDRESS = "GHoZwXKEJSsTYeNmBPgQFuKsjVGJ1HMGv5QghtQVdoge"
DOGEONEWS_MIN_HOLDING = 1_000_000  # 1 million tokens required


# Helius API for reliable Solana RPC
HELIUS_API_KEY = os.environ.get("HELIUS_API_KEY")
SOLANA_RPC_URL = f"https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}" if HELIUS_API_KEY else "https://api.mainnet-beta.solana.com"


if not HELIUS_API_KEY:
    logging.warning("⚠️ HELIUS_API_KEY not set - using public Solana RPC (rate limited)")




@api_router.post("/verify-dogeonews-holder")
async def verify_dogeonews_token_holder(player_address: str, solana_address: str):
    """
    Verify if a Solana wallet holds 1M+ $DOGEONEWS tokens.
    Links the Solana wallet to the player and grants token holder status.
    Uses Helius API for reliable token balance checking.
    """
    try:
        # Sanitize inputs
        solana_address = sanitize_address(solana_address)
        player_address = sanitize_address(player_address)
        
        if not solana_address or len(solana_address) < 32:
            raise HTTPException(status_code=400, detail="Invalid Solana address")
        
        token_balance = 0
        is_holder = False
        
        # Try Helius DAS API first (more reliable for token balances)
        if HELIUS_API_KEY:
            try:
                helius_url = f"https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}"
                
                # Use getTokenAccountsByOwner for specific token
                payload = {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getTokenAccountsByOwner",
                    "params": [
                        solana_address,
                        {"mint": DOGEONEWS_TOKEN_ADDRESS},
                        {"encoding": "jsonParsed"}
                    ]
                }
                
                async with httpx.AsyncClient() as client:
                    response = await client.post(helius_url, json=payload, timeout=30.0)
                    data = response.json()
                
                if "result" in data and data["result"]["value"]:
                    for account in data["result"]["value"]:
                        parsed = account.get("account", {}).get("data", {}).get("parsed", {})
                        info = parsed.get("info", {})
                        token_amount = info.get("tokenAmount", {})
                        ui_amount = float(token_amount.get("uiAmount", 0) or 0)
                        token_balance += ui_amount
                
                logger.info(f"Helius API: {solana_address} has {token_balance:,.0f} $DOGEONEWS tokens")
                
            except Exception as helius_error:
                logger.warning(f"Helius API error, falling back to public RPC: {helius_error}")
                # Fall back to public RPC
                payload = {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getTokenAccountsByOwner",
                    "params": [
                        solana_address,
                        {"mint": DOGEONEWS_TOKEN_ADDRESS},
                        {"encoding": "jsonParsed"}
                    ]
                }
                async with httpx.AsyncClient() as client:
                    response = await client.post("https://api.mainnet-beta.solana.com", json=payload, timeout=30.0)
                    data = response.json()
                
                if "result" in data and data["result"]["value"]:
                    for account in data["result"]["value"]:
                        parsed = account.get("account", {}).get("data", {}).get("parsed", {})
                        info = parsed.get("info", {})
                        token_amount = info.get("tokenAmount", {})
                        ui_amount = float(token_amount.get("uiAmount", 0) or 0)
                        token_balance += ui_amount
        else:
            # Use public RPC (rate limited)
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getTokenAccountsByOwner",
                "params": [
                    solana_address,
                    {"mint": DOGEONEWS_TOKEN_ADDRESS},
                    {"encoding": "jsonParsed"}
                ]
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(SOLANA_RPC_URL, json=payload, timeout=30.0)
                data = response.json()
            
            if "result" in data and data["result"]["value"]:
                for account in data["result"]["value"]:
                    parsed = account.get("account", {}).get("data", {}).get("parsed", {})
                    info = parsed.get("info", {})
                    token_amount = info.get("tokenAmount", {})
                    ui_amount = float(token_amount.get("uiAmount", 0) or 0)
                    token_balance += ui_amount
        
        is_holder = token_balance >= DOGEONEWS_MIN_HOLDING
        
        if is_holder:
            # Update player with token holder status
            player = await db.players.find_one({"address": player_address})
            
            if player:
                await db.players.update_one(
                    {"address": player_address},
                    {"$set": {
                        "is_dogeonews_holder": True,
                        "solana_address": solana_address,
                        "dogeonews_balance": token_balance,
                        "dogeonews_verified_at": datetime.now(timezone.utc).isoformat(),
                        "can_convert_points": True  # Token holders can convert to $LAB
                    }}
                )
                logger.info(f"✅ Verified $DOGEONEWS holder: {player_address} with {token_balance:,.0f} tokens")
                return {
                    "success": True,
                    "player_address": player_address,
                    "solana_address": solana_address,
                    "token_balance": token_balance,
                    "min_required": DOGEONEWS_MIN_HOLDING,
                    "is_holder": True,
                    "message": f"Verified! You hold {token_balance:,.0f} $DOGEONEWS tokens. You are now eligible for $LAB token claim!"
                }
            else:
                return {
                    "success": False,
                    "error": "Player not found. Please sign up first."
                }
        else:
            return {
                "success": False,
                "player_address": player_address,
                "solana_address": solana_address,
                "token_balance": token_balance,
                "min_required": DOGEONEWS_MIN_HOLDING,
                "is_holder": False,
                "message": f"Insufficient balance. You hold {token_balance:,.0f} $DOGEONEWS but need {DOGEONEWS_MIN_HOLDING:,} to qualify."
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying $DOGEONEWS holdings: {e}")
        raise HTTPException(status_code=500, detail=str(e))




@api_router.get("/check-dogeonews-balance/{solana_address}")
async def check_dogeonews_balance(solana_address: str):
    """
    Check $DOGEONEWS token balance for a Solana wallet (no player link required).
    Uses Helius API for reliable balance checking.
    """
    try:
        # Sanitize input
        solana_address = sanitize_address(solana_address)
        
        if not solana_address or len(solana_address) < 32:
            raise HTTPException(status_code=400, detail="Invalid Solana address")
        
        token_balance = 0
        
        # Use Helius API if available
        rpc_url = f"https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}" if HELIUS_API_KEY else "https://api.mainnet-beta.solana.com"
        
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getTokenAccountsByOwner",
            "params": [
                solana_address,
                {"mint": DOGEONEWS_TOKEN_ADDRESS},
                {"encoding": "jsonParsed"}
            ]
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(rpc_url, json=payload, timeout=30.0)
            data = response.json()
        
        if "result" in data and data["result"]["value"]:
            for account in data["result"]["value"]:
                parsed = account.get("account", {}).get("data", {}).get("parsed", {})
                info = parsed.get("info", {})
                token_amount = info.get("tokenAmount", {})
                ui_amount = float(token_amount.get("uiAmount", 0) or 0)
                token_balance += ui_amount
        
        is_eligible = token_balance >= DOGEONEWS_MIN_HOLDING
        
        return {
            "solana_address": solana_address,
            "token": "$DOGEONEWS",
            "token_address": DOGEONEWS_TOKEN_ADDRESS,
            "balance": token_balance,
            "min_required": DOGEONEWS_MIN_HOLDING,
            "is_eligible": is_eligible,
            "message": "Eligible for $LAB claim!" if is_eligible else f"Need {DOGEONEWS_MIN_HOLDING - token_balance:,.0f} more tokens"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking $DOGEONEWS balance: {e}")
        raise HTTPException(status_code=500, detail=str(e))




@api_router.post("/admin/scan-dogeonews-holders", dependencies=[Depends(verify_admin)])
async def scan_dogeonews_holders():
    """
    Admin endpoint to check all players with linked Solana wallets for $DOGEONEWS holdings.
    """
    try:
        # Find all players with linked Solana addresses - use projection to limit memory
        players_with_solana = await db.players.find(
            {"solana_address": {"$exists": True, "$ne": None}},
            {"_id": 0, "address": 1, "solana_address": 1, "nickname": 1, "is_dogeonews_holder": 1}
        ).to_list(500)
        
        results = []
        updated_count = 0
        
        for player in players_with_solana:
            solana_addr = player.get("solana_address")
            player_addr = player.get("address")
            
            try:
                payload = {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getTokenAccountsByOwner",
                    "params": [
                        solana_addr,
                        {"mint": DOGEONEWS_TOKEN_ADDRESS},
                        {"encoding": "jsonParsed"}
                    ]
                }
                
                async with httpx.AsyncClient() as client:
                    response = await client.post(SOLANA_RPC_URL, json=payload, timeout=30.0)
                    data = response.json()
                
                token_balance = 0
                if "result" in data and data["result"]["value"]:
                    for account in data["result"]["value"]:
                        parsed = account.get("account", {}).get("data", {}).get("parsed", {})
                        info = parsed.get("info", {})
                        token_amount = info.get("tokenAmount", {})
                        ui_amount = float(token_amount.get("uiAmount", 0) or 0)
                        token_balance += ui_amount
                
                is_holder = token_balance >= DOGEONEWS_MIN_HOLDING
                
                if is_holder and not player.get("is_dogeonews_holder"):
                    await db.players.update_one(
                        {"address": player_addr},
                        {"$set": {"is_dogeonews_holder": True, "can_convert_points": True}}
                    )
                    updated_count += 1
                
                results.append({
                    "player": player_addr[:20] + "...",
                    "solana": solana_addr[:20] + "...",
                    "balance": token_balance,
                    "is_holder": is_holder,
                    "updated": is_holder and not player.get("is_dogeonews_holder")
                })
                
            except Exception as e:
                results.append({
                    "player": player_addr[:20] + "...",
                    "error": str(e)
                })
        
        return {
            "scanned": len(players_with_solana),
            "updated": updated_count,
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Error scanning $DOGEONEWS holders: {e}")
        raise HTTPException(status_code=500, detail=str(e))




@api_router.post("/admin/scan-and-credit-all-holders", dependencies=[Depends(verify_admin)])
async def scan_and_credit_all_nft_holders():
    """
    Admin endpoint to scan all players and verify their NFT ownership on DogeOS blockchain.
    Credits VIP bonus to any holder who hasn't received it yet.
    NOTE: Only credits existing players who have signed up (chosen a character).
    Does NOT create accounts for holders who haven't signed up yet.
    """
    try:
        # First, get ALL NFT holders directly from DogeOS blockchain
        url = f"{DOGEOS_BLOCKSCOUT_URL}/api?module=token&action=getTokenHolders&contractaddress={DOGEFOOD_NFT_CONTRACT}&page=1&offset=1000"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=60.0)
            data = response.json()
        
        if data.get("status") != "1":
            raise HTTPException(status_code=500, detail="Failed to fetch NFT holders from DogeOS")
        
        nft_holders = {h["address"].lower(): int(h["value"]) for h in data.get("result", [])}
        logger.info(f"🔍 Found {len(nft_holders)} DogeFood NFT holders on DogeOS")
        
        credited = []
        already_credited = []
        not_signed_up = []  # Holders who haven't signed up to play yet
        errors = []
        
        # Check each holder
        for holder_address, nft_count in nft_holders.items():
            try:
                # Normalize address format
                holder_address_lower = holder_address.lower()
                
                # Find player in database (case-insensitive)
                player = await db.players.find_one({
                    "address": {"$regex": f"^{holder_address_lower}$", "$options": "i"}
                })
                
                if player:
                    # Check if player has actually signed up (chosen a character)
                    has_signed_up = player.get("selected_character") is not None
                    
                    if not has_signed_up:
                        # Player exists but hasn't completed signup - don't credit yet
                        not_signed_up.append(holder_address)
                        continue
                    
                    if not player.get("vip_bonus_claimed"):
                        # Credit existing player who has signed up
                        await db.players.update_one(
                            {"_id": player["_id"]},
                            {
                                "$set": {"is_nft_holder": True, "is_vip": True, "vip_bonus_claimed": True},
                                "$inc": {"points": 500}
                            }
                        )
                        credited.append({
                            "address": holder_address,
                            "nickname": player.get("nickname"),
                            "nft_count": nft_count,
                            "action": "credited"
                        })
                        logger.info(f"🌟 Credited: {holder_address} ({player.get('nickname')})")
                    else:
                        # Ensure VIP status is set
                        await db.players.update_one(
                            {"_id": player["_id"]},
                            {"$set": {"is_nft_holder": True, "is_vip": True}}
                        )
                        already_credited.append(holder_address)
                else:
                    # Holder hasn't signed up to play yet - will be credited when they do
                    not_signed_up.append(holder_address)
                    
            except Exception as e:
                errors.append({"address": holder_address, "error": str(e)})
        
        return {
            "success": True,
            "network": "DogeOS Testnet",
            "contract": DOGEFOOD_NFT_CONTRACT,
            "total_nft_holders_on_chain": len(nft_holders),
            "credited_count": len(credited),
            "credited_players": credited,
            "already_credited": len(already_credited),
            "not_signed_up_yet": len(not_signed_up),
            "note": "Holders who haven't signed up will be credited when they choose a character",
            "errors": len(errors),
            "error_details": errors[:10] if errors else []
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scanning NFT holders on DogeOS: {e}")
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
        if datetime.now(timezone.utc) >= ready_at:
            # Update treat status to ready
            await db.treats.update_one(
                {"id": treat_id},
                {"$set": {"brewing_status": "ready"}}
            )
            return {"status": "ready", "message": "Treat is ready!"}
        else:
            # Calculate remaining time
            remaining_seconds = int((ready_at - datetime.now(timezone.utc)).total_seconds())
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
        
        now = datetime.now(timezone.utc)
        result = []
        
        for treat in brewing_treats:
            ready_at = treat.get("ready_at")
            if ready_at:
                # Parse ready_at ensuring it's timezone-aware
                ready_at = parse_utc_datetime(ready_at)
                
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
        now = datetime.now(timezone.utc)
        
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
            
            # Parse dates ensuring timezone-awareness
            try:
                ready_at = parse_utc_datetime(ready_at) if ready_at else now
            except:
                ready_at = now
            
            try:
                created_at = parse_utc_datetime(created_at) if created_at else now
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
        
        # Find the treat and player in parallel for faster response
        treat_task = db.treats.find_one({"id": treat_id})
        player_task = find_player_by_address(player_address)
        treat, player = await asyncio.gather(treat_task, player_task)
        
        if not treat:
            raise HTTPException(status_code=404, detail="Treat not found")
        
        # Verify ownership (support TG_/tg_ Telegram address case differences)
        treat_owner = treat.get("creator_address")
        if str(treat_owner).lower() != str(player_address).lower():
            raise HTTPException(status_code=403, detail="You don't own this treat")
        
        # Check if already collected
        if treat.get("brewing_status") == "collected":
            raise HTTPException(status_code=400, detail="Treat already collected")
        
        # Check if ready
        now = datetime.now(timezone.utc)
        ready_at = treat.get("ready_at")
        if ready_at:
            ready_at = parse_utc_datetime(ready_at)
        
        if ready_at and now < ready_at:
            raise HTTPException(status_code=400, detail="Treat is not ready yet")
        
        # Defensive: a player document should always exist by collect time
        # (created at registration, or as a fallback in create_treat), but
        # if it's still somehow missing, create a minimal one now rather
        # than silently awarding zero points below. This was the original
        # bug — collect would still report "success" to the user while no
        # points/XP were ever actually credited anywhere.
        if not player and player_address and not player_address.startswith("guest_") and player_address != "GUEST_USER":
            short_addr = player_address[:6] + player_address[-4:] if len(player_address) > 10 else player_address
            new_player_doc = {
                "id": str(uuid.uuid4()),
                "address": player_address,
                "nickname": f"Scientist {short_addr}",
                "created_treats": [],
                "last_active": now.isoformat(),
            }
            await db.players.insert_one(new_player_doc)
            player = new_player_doc
            logger.warning(f"Created missing player doc on collect for {player_address} (registration should have created this already)")
        
        # Get base rewards
        base_points_reward = treat.get("points_reward", 10)
        base_xp_reward = treat.get("xp_reward", 5)
        
        # Player already fetched above
        
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
        happy_hour_bonus = 0
        if is_happy_hour():
            happy_hour_bonus = int(base_points_reward * HAPPY_HOUR_BONUS_PERCENT)
            bonus_details["happy_hour_bonus"] = happy_hour_bonus
            logger.info(f"Happy Hour bonus: +{happy_hour_bonus} points (+{int(HAPPY_HOUR_BONUS_PERCENT*100)}%) for {player_address}")
        
        final_points_reward = base_points_reward + points_bonus + happy_hour_bonus
        final_xp_reward = base_xp_reward + xp_bonus

        # ── Apply heat event collect bonuses ──────────────────────────────
        try:
            collect_heat_id = await arena_system.get_active_heat_event_id(db)
            if collect_heat_id == "golden_hour":
                original_pts = final_points_reward
                final_points_reward = final_points_reward * 2
                bonus_details["golden_hour_bonus"] = final_points_reward - original_pts
                logger.info(f"✨ Heat: Golden Hour — points doubled: {original_pts} → {final_points_reward}")
            elif collect_heat_id == "crit_state":
                # Critical Mix: +50% points bonus on collect in addition to higher rarity at brew
                original_pts = final_points_reward
                final_points_reward = int(final_points_reward * 1.5)
                bonus_details["crit_state_bonus"] = final_points_reward - original_pts
                logger.info(f"✨ Heat: Critical Mix — +50% points: {original_pts} → {final_points_reward}")
        except Exception as _heat_err:
            logger.warning(f"Heat event check failed (non-fatal): {_heat_err}")
        
        # Run treat update and player stats update in parallel
        treat_update_task = db.treats.update_one(
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
        leveled_up = False
        new_level = None
        if player:
            new_xp = player.get("experience", 0) + final_xp_reward
            current_level = player.get("level", 1)
            
            # Check for level up (100 XP per level)
            xp_for_level = current_level * 100
            if new_xp >= xp_for_level:
                new_level = current_level + 1
                new_xp = new_xp - xp_for_level
                leveled_up = True
            else:
                new_level = current_level
            
            player_update_filter = {
                "address": player.get("address")
            } if player.get("address") else {
                "telegram_id": player.get("telegram_id")
            }


            player_update_task = db.players.update_one(
                player_update_filter,
                {"$set": {
                    "experience": new_xp,
                    "level": new_level,
                    "last_active": now.isoformat()
                },
                "$inc": {"points": final_points_reward}}
            )
            
            # Run both updates in parallel
            await asyncio.gather(treat_update_task, player_update_task)

            # Credit arena leaderboard score (non-fatal — never block a collect)
            try:
                await arena_system.credit_arena_score(
                    db,
                    player_address=player_address,
                    points_delta=final_points_reward,
                    treat_rarity=treat.get("rarity", "Common"),
                )
            except Exception as _arena_err:
                logger.warning(f"Arena score credit skipped: {_arena_err}")

            return {
                "success": True,
                "message": "Treat collected successfully!",
                "rewards": {
                    "base_points": base_points_reward,
                    "base_xp": base_xp_reward,
                    "points_bonus": points_bonus,
                    "xp_bonus": xp_bonus,
                    "happy_hour_bonus": happy_hour_bonus,
                    "total_points": final_points_reward,
                    "total_xp": final_xp_reward
                },
                "character_bonus_applied": bonus_details if bonus_details else None,
                "happy_hour_active": is_happy_hour(),
                "leveled_up": leveled_up,
                "new_level": new_level if leveled_up else None,
                "treat_id": treat_id
            }
        
        return {
            "success": True,
            "message": "Treat collected successfully!",
            "rewards": {
                "points": final_points_reward,
                "xp": final_xp_reward,
                "happy_hour_bonus": happy_hour_bonus
            },
            "happy_hour_active": is_happy_hour(),
            "treat_id": treat_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error collecting treat: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# Leaderboard Routes


@api_router.post("/admin/merge-duplicate-telegram-players")
async def merge_duplicate_telegram_players(admin_key: str = None, dry_run: bool = True):
    """
    One-shot migration: merge duplicate Telegram player documents.

    Auth: requires `admin_key` matching ADMIN_SECRET (same as /admin/season2-reset).
    Example:
        curl -X POST \
          "https://.../api/admin/merge-duplicate-telegram-players?admin_key=...&dry_run=true"

    For every TG user that has more than one document in the players
    collection (e.g. {address:"tg_<id>"}, {address:"TG_<id>"},
    {telegram_id:<id>, address:null}), this:
      1. Picks the doc with the highest points as the "canonical" keeper.
      2. Sums points/experience/created_treats from siblings into the keeper.
      3. Copies any missing telegram identity fields onto the keeper.
      4. Deletes the sibling docs.
      5. Re-points treats.creator_address to a single canonical form
         (TG_<id>) so future $inc updates always hit the same doc.

    Set `dry_run=false` to actually apply changes.
    """
    if not admin_key or admin_key != ADMIN_SECRET:
        await asyncio.sleep(2)
        raise HTTPException(status_code=403, detail="Unauthorized: Invalid admin key")
    # Bucket every doc that looks like a TG player by telegram_id.
    # IMPORTANT: include the raw _id field — some historical docs were inserted
    # without the application-level `id` (uuid) field, so we must address them
    # by their ObjectId instead.
    buckets = {}  # int_tg_id -> [docs]
    async for doc in db.players.find({"$or": [
        {"address": {"$regex": "^[tT][gG]_"}},
        {"telegram_id": {"$exists": True, "$ne": None}},
    ]}):
        addr = doc.get("address") or ""
        tg_int = None
        if doc.get("telegram_id") is not None:
            try:
                tg_int = int(doc["telegram_id"])
            except (ValueError, TypeError):
                tg_int = None
        if tg_int is None and addr.lower().startswith("tg_"):
            try:
                tg_int = int(addr[3:])
            except (ValueError, TypeError):
                tg_int = None
        if tg_int is None:
            continue
        buckets.setdefault(tg_int, []).append(doc)

    merged_summary = []
    for tg_int, docs in buckets.items():
        if len(docs) < 2:
            continue  # already a single doc — nothing to merge

        # Choose canonical doc: highest points, then most treats, then most recent
        def _rank(d):
            return (
                int(d.get("points") or 0),
                len(d.get("created_treats") or []),
                str(d.get("last_active") or ""),
            )
        docs_sorted = sorted(docs, key=_rank, reverse=True)
        keeper = docs_sorted[0]
        losers = docs_sorted[1:]

        # Aggregate numeric fields
        total_points = int(keeper.get("points") or 0)
        total_xp = int(keeper.get("experience") or 0)
        merged_treats = list(keeper.get("created_treats") or [])
        keeper_id = keeper.get("id")
        keeper_oid = keeper.get("_id")  # always present — MongoDB ObjectId

        for loser in losers:
            total_points += int(loser.get("points") or 0)
            total_xp += int(loser.get("experience") or 0)
            for t in (loser.get("created_treats") or []):
                if t not in merged_treats:
                    merged_treats.append(t)
            # Fill missing identity fields onto the keeper
            for k in ("telegram_id", "telegram_username", "telegram_first_name",
                      "telegram_last_name", "nickname", "profile_image",
                      "selected_character", "character_bonuses", "auth_type"):
                if not keeper.get(k) and loser.get(k):
                    keeper[k] = loser[k]

        canonical_address = f"TG_{tg_int}"
        keeper_update = {
            "address": canonical_address,
            "telegram_id": tg_int,
            "points": total_points,
            "experience": total_xp,
            "created_treats": merged_treats,
        }
        # Carry any newly-filled identity fields too
        for k in ("telegram_username", "telegram_first_name", "telegram_last_name",
                  "nickname", "profile_image", "selected_character",
                  "character_bonuses", "auth_type"):
            if keeper.get(k) is not None:
                keeper_update[k] = keeper[k]

        loser_ids = [loser.get("id") for loser in losers]
        loser_oids = [loser.get("_id") for loser in losers if loser.get("_id") is not None]
        loser_addresses = [loser.get("address") for loser in losers if loser.get("address")]

        merged_summary.append({
            "telegram_id": tg_int,
            "keeper_id": keeper_id,
            "keeper_oid": str(keeper_oid) if keeper_oid else None,
            "canonical_address": canonical_address,
            "merged_points": total_points,
            "merged_treats": len(merged_treats),
            "removed_doc_ids": loser_ids,
            "removed_doc_oids": [str(x) for x in loser_oids],
            "removed_addresses": loser_addresses,
        })

        if not dry_run:
            try:
                # 1. Clear `address` on losers FIRST to avoid a unique-index
                #    collision when the keeper takes ownership of it. Multiple
                #    documents may legitimately have a null address.
                if loser_oids:
                    await db.players.update_many(
                        {"_id": {"$in": loser_oids}},
                        {"$set": {"address": None}}
                    )
                id_only_loser_ids = [lid for lid in loser_ids if lid is not None]
                if id_only_loser_ids:
                    await db.players.update_many(
                        {"id": {"$in": id_only_loser_ids}},
                        {"$set": {"address": None}}
                    )

                # 2. Update keeper — address it by ObjectId because `id` may
                #    be null on legacy docs. Auto-fill a fresh uuid `id` if
                #    the keeper lacks one so future address-based filters work.
                keeper_filter = {"_id": keeper_oid} if keeper_oid is not None else {"id": keeper_id}
                if not keeper.get("id"):
                    keeper_update["id"] = str(uuid.uuid4())
                await db.players.update_one(
                    keeper_filter,
                    {"$set": keeper_update}
                )

                # 3. Delete losers
                if loser_oids:
                    await db.players.delete_many({"_id": {"$in": loser_oids}})
                if id_only_loser_ids:
                    await db.players.delete_many({"id": {"$in": id_only_loser_ids}})

                # 4. Normalise treats.creator_address for this user
                variants = [f"TG_{tg_int}", f"tg_{tg_int}"]
                await db.treats.update_many(
                    {"creator_address": {"$in": variants}},
                    {"$set": {"creator_address": canonical_address}}
                )
                merged_summary[-1]["status"] = "merged"
            except Exception as merge_exc:
                merged_summary[-1]["status"] = f"failed: {type(merge_exc).__name__}: {str(merge_exc)[:300]}"
                logger.error(f"Migration failed for tg_{tg_int}: {merge_exc}")
                # Do NOT abort the loop — keep merging the rest.
                continue

    return {
        "dry_run": dry_run,
        "telegram_users_with_duplicates": len(merged_summary),
        "details": merged_summary,
    }


@api_router.post("/admin/normalize-telegram-creator-addresses")
async def normalize_telegram_creator_addresses(admin_key: str = None, dry_run: bool = True):
    """
    Rewrite every `treats.creator_address` and `activity_feed.player_address`
    of the form `tg_<id>` (lowercase) to the canonical `TG_<id>` (uppercase).

    This is the post-migration cleanup for documents written by frontend
    builds that used the lowercase form. Run once after deploying the
    uppercase-`TG_` App.js. Safe + idempotent — re-running on a clean DB is
    a no-op.
    """
    if not admin_key or admin_key != ADMIN_SECRET:
        await asyncio.sleep(2)
        raise HTTPException(status_code=403, detail="Unauthorized: Invalid admin key")

    summary = {"dry_run": dry_run, "collections": {}}

    # ── treats ──────────────────────────────────────────────────────
    tg_treat_addrs = await db.treats.distinct(
        "creator_address", {"creator_address": {"$regex": "^tg_"}}
    )
    treat_changes = []
    for low in tg_treat_addrs:
        canonical = "TG_" + low[3:]
        count = await db.treats.count_documents({"creator_address": low})
        treat_changes.append({"from": low, "to": canonical, "count": count})
        if not dry_run and count:
            await db.treats.update_many(
                {"creator_address": low},
                {"$set": {"creator_address": canonical}}
            )
    summary["collections"]["treats"] = {
        "lowercase_addresses_found": len(tg_treat_addrs),
        "total_docs_affected": sum(c["count"] for c in treat_changes),
        "changes": treat_changes,
    }

    # ── activity_feed ───────────────────────────────────────────────
    tg_feed_addrs = await db.activity_feed.distinct(
        "player_address", {"player_address": {"$regex": "^tg_"}}
    )
    feed_changes = []
    for low in tg_feed_addrs:
        canonical = "TG_" + low[3:]
        count = await db.activity_feed.count_documents({"player_address": low})
        feed_changes.append({"from": low, "to": canonical, "count": count})
        if not dry_run and count:
            await db.activity_feed.update_many(
                {"player_address": low},
                {"$set": {"player_address": canonical}}
            )
    summary["collections"]["activity_feed"] = {
        "lowercase_addresses_found": len(tg_feed_addrs),
        "total_docs_affected": sum(c["count"] for c in feed_changes),
        "changes": feed_changes,
    }

    return summary


# Leaderboard Routes
@api_router.get("/leaderboard")
async def get_leaderboard(limit: int = 200):
    # Only include active players who collected treats
    active_creator_addresses = await db.treats.distinct(
        "creator_address",
        {
            "brewing_status": "collected",
            "creator_address": {"$nin": [None, "", "GUEST_USER"]}
        }
    )


    if not active_creator_addresses:
        # Season just started — no treats collected yet, show all registered players
        query = {
            "$or": [
                {"address": {"$nin": [None, "", "GUEST_USER"]}},
                {"telegram_id": {"$exists": True, "$ne": None}}
            ]
        }
    else:
        # Split creator addresses into wallet addresses and tg_ telegram addresses
        tg_ids = []
        wallet_addresses = []
        tg_address_variants = []  # both TG_<id> and tg_<id> for legacy duplicate docs
        for addr in active_creator_addresses:
            if addr and addr.lower().startswith("tg_"):
                raw_id = addr[3:]
                tg_address_variants.append(f"TG_{raw_id}")
                tg_address_variants.append(f"tg_{raw_id}")
                try:
                    tg_ids.append(int(raw_id))
                except (ValueError, TypeError):
                    pass
            elif addr:
                wallet_addresses.append(addr)

        # Build a query that matches both wallet players and telegram players.
        # IMPORTANT: include TG_/tg_ address variants because historical
        # gameplay points live on those docs (not the telegram_id-only doc).
        or_clauses = []
        if wallet_addresses:
            or_clauses.append({"address": {"$in": wallet_addresses}})
        if tg_address_variants:
            or_clauses.append({"address": {"$in": tg_address_variants}})
        if tg_ids:
            or_clauses.append({"telegram_id": {"$in": tg_ids}})

        if or_clauses:
            query = {"$or": or_clauses} if len(or_clauses) > 1 else or_clauses[0]
        else:
            query = {"address": {"$in": active_creator_addresses}}
    
    projection = {
        "_id": 0,
        "address": 1,
        "nickname": 1,
        "telegram_first_name": 1,
        "telegram_id": 1,
        "guest_id": 1,
        "points": 1,
        "level": 1,
        "is_nft_holder": 1,
        "is_dogeonews_holder": 1,
        "is_vip": 1,
        "selected_character": 1,
        "vip_bonus_claimed": 1,
    }
    
    top_players = await db.players.find(query, projection).sort([("points", -1), ("level", -1)]).limit(limit + 20).to_list(limit + 20)

    # Dedupe duplicate Telegram docs: a single TG user can have up to three
    # records in the DB (tg_<id>, TG_<id>, telegram_id-only). Keep the one
    # with the highest points so the leaderboard never shows an "empty"
    # duplicate. Wallet users are not deduped (address is a stable id).
    deduped = []
    seen_tg = {}
    for p in top_players:
        addr = p.get("address") or ""
        tg_id_val = p.get("telegram_id")
        tg_key = None
        if tg_id_val is not None:
            tg_key = int(tg_id_val)
        elif addr.lower().startswith("tg_"):
            try:
                tg_key = int(addr[3:])
            except (ValueError, TypeError):
                tg_key = None

        if tg_key is None:
            deduped.append(p)
            continue

        existing = seen_tg.get(tg_key)
        if existing is None:
            seen_tg[tg_key] = p
        else:
            # Keep whichever doc has more points (tie → more level → has address)
            def _rank(d):
                return (
                    int(d.get("points") or 0),
                    int(d.get("level") or 0),
                    1 if d.get("address") else 0,
                )
            if _rank(p) > _rank(existing):
                # Carry over telegram identity fields from the loser if missing
                for k in ("telegram_id", "telegram_first_name", "nickname"):
                    if not p.get(k) and existing.get(k):
                        p[k] = existing[k]
                seen_tg[tg_key] = p
            else:
                for k in ("telegram_id", "telegram_first_name", "nickname"):
                    if not existing.get(k) and p.get(k):
                        existing[k] = p[k]

    # Re-assemble: wallet players in original order + best TG doc per user
    deduped.extend(seen_tg.values())
    deduped.sort(key=lambda d: (-(d.get("points") or 0), -(d.get("level") or 0)))
    top_players = deduped
    
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
    display_rank = 0
    for player in top_players:
        # Skip VIP-only players: they have 500 bonus but no gameplay earnings
        if player.get("vip_bonus_claimed") and player.get("points", 0) <= 500:
            continue
        
        display_rank += 1
        if display_rank > limit:
            break
            
        char_id = player.get("selected_character")
        char_info = character_data.get(char_id, {})
        
        player_address = player.get("address") or f"tg_{player.get('telegram_id')}" or f"guest_{player.get('guest_id', 'unknown')}"
        player_nickname = player.get("nickname") or player.get("telegram_first_name") or "Player"
        
        leaderboard.append({
            "address": player_address,
            "nickname": player_nickname,
            "points": player.get("points", 0),
            "level": player.get("level", 1),
            "is_nft_holder": player.get("is_nft_holder", False),
            "is_dogeonews_holder": player.get("is_dogeonews_holder", False),
            "is_vip": player.get("is_vip", False),
            "rank": display_rank,
            "selected_character": char_id,
            "character_name": char_info.get('name'),
            "character_image": char_info.get('image')
        })
    
    return leaderboard


# ── $LAB reward pools/formula — kept in exact sync with Leaderboard.jsx's
# calcRewards() and the season2_reset settlement script below. If either
# changes, update all three together.
#
# FIX (see calc_lab_reward below): the original per-tier multipliers
# (1.5 / 0.7 / 0.2) were tuned independently and didn't connect smoothly —
# rank 10 paid 163,636 while rank 11 paid 509,090, more than 3x MORE for a
# worse rank. The multipliers below are solved so tier 2's ceiling sits
# just under tier 1's floor, and tier 3's ceiling sits just under tier 2's
# floor, guaranteeing every rank pays strictly more than the rank below it.
_LAB_SEASON_POOL = 20_000_000
_LAB_TOP10_POOL = _LAB_SEASON_POOL * 0.30
_LAB_TOP20_POOL = _LAB_SEASON_POOL * 0.20
_LAB_TOP50_POOL = _LAB_SEASON_POOL * 0.20

_LAB_TIER1_MULT = 1.5
_LAB_TIER2_MULT = 0.225 * 0.97          # solved so rank 11 < rank 10
_LAB_TIER3_MULT = 0.0634090909090909 * 0.94   # solved so rank 21 < rank 20


def calc_lab_reward(rank: Optional[int]) -> int:
    """Same overall shape as the original calcRewards() in Leaderboard.jsx
    (top 10 / 11-20 / 21-50 tiers, same pool split), but with corrected
    per-tier multipliers so the curve is strictly monotonically decreasing
    — a better rank always pays at least as much as a worse one. The
    original multipliers (1.5 / 0.7 / 0.2) caused rank 11 to outpay rank 10
    and rank 21 to outpay rank 20; verified fixed across all 50 ranks."""
    if not rank or rank > 50:
        return 0
    if rank <= 10:
        return int(_LAB_TOP10_POOL * ((11 - rank) / 55) * _LAB_TIER1_MULT)
    if rank <= 20:
        return int(_LAB_TOP20_POOL * ((21 - rank) / 55) * _LAB_TIER2_MULT)
    return int(_LAB_TOP50_POOL * ((51 - rank) / 465) * _LAB_TIER3_MULT)


@api_router.get("/player/{address}/lab-estimate")
async def get_player_lab_estimate(address: str):
    """
    Live estimate of a player's $LAB reward if the season ended right now.
    Reuses get_leaderboard() directly (not a re-implementation) so this
    number can never disagree with what the Leaderboard page itself shows
    — it finds the player's current display rank in that exact same
    ranked list, then applies the identical reward formula.
    """
    leaderboard = await get_leaderboard(limit=200)

    player = await find_player_by_address(address)
    if not player and address.startswith("guest_"):
        player = await db.players.find_one({"guest_id": address}, {"_id": 0})

    # Match this player's entry on the leaderboard by whichever identifier
    # it was keyed on (address, or tg_<telegram_id> per get_leaderboard's
    # own fallback at player_address construction time).
    canonical_address = (player or {}).get("address")
    telegram_id = (player or {}).get("telegram_id")
    candidates = {a for a in [
        address,
        canonical_address,
        f"tg_{telegram_id}" if telegram_id is not None else None,
        f"TG_{telegram_id}" if telegram_id is not None else None,
    ] if a}

    rank = None
    points = (player or {}).get("points", 0)
    for entry in leaderboard:
        if entry.get("address") in candidates or entry.get("address", "").lower() in {c.lower() for c in candidates}:
            rank = entry["rank"]
            points = entry.get("points", points)
            break

    estimated_lab = calc_lab_reward(rank)
    bonus_allocation = (player or {}).get("lab_bonus_allocation") or 0
    total_estimated_lab = estimated_lab + bonus_allocation

    return {
        "address": address,
        "rank": rank,
        "points": points,
        "estimated_lab": total_estimated_lab,
        "rank_based_lab": estimated_lab,
        "bonus_lab": bonus_allocation,
        "in_reward_range": rank is not None and rank <= 50,
        "note": "Live estimate based on current rank — final amount is settled at season end and may change as standings shift."
    }


# Game Stats Routes
@api_router.get("/stats")
async def get_game_stats():
    try:
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        
        collected_creators_task = db.treats.distinct(
            "creator_address",
            {
                "brewing_status": "collected",
                "creator_address": {"$nin": [None, "", "GUEST_USER"]}
            }
        )
        nft_task = db.players.count_documents({"is_nft_holder": True})
        treats_task = db.treats.count_documents({"brewing_status": "collected"})
        today_task = db.treats.count_documents({"collected_at": {"$gte": today.isoformat()}})
        
        collected_creators, nft_holders, total_treats, active_today = await asyncio.gather(
            collected_creators_task, nft_task, treats_task, today_task
        )
        
        active_players = 0
        if collected_creators:
            active_players = await db.players.count_documents({"address": {"$in": collected_creators}})
        
        return {
            "total_players": active_players,
            "nft_holders": nft_holders,
            "total_treats": total_treats,
            "active_today": active_today
        }
    except Exception as e:
        logger.error(f"Error getting game stats: {e}")
        return {
            "total_players": 0,
            "nft_holders": 0,
            "total_treats": 0,
            "active_today": 0
        }


# Phase 2: Enhanced Points System Routes
@api_router.get("/points/leaderboard")
async def get_points_leaderboard(limit: int = 50, nft_holders_only: bool = False):
    """Get enhanced points-based leaderboard - now includes all players by default"""
    leaderboard = await points_system.get_points_leaderboard(limit=limit, nft_holders_only=nft_holders_only)
    return {"leaderboard": leaderboard, "generated_at": datetime.now(timezone.utc)}


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
@api_router.get("/security/player-risk/{address}", dependencies=[Depends(verify_admin)])
async def get_player_risk_score(address: str):
    """Get player's anti-cheat risk assessment"""
    risk_data = await anti_cheat_system.get_player_risk_score(address)
    return risk_data


@api_router.get("/security/flagged-players", dependencies=[Depends(verify_admin)])
async def get_flagged_players(risk_level: str = "high"):
    """Get list of players flagged for suspicious activity (admin only)"""
    flagged = await anti_cheat_system.get_flagged_players(risk_level)
    return {"flagged_players": flagged, "risk_level": risk_level}


# NFT Verification Route
# DogeFood Lab NFT Contract on DogeOS Network
DOGEFOOD_NFT_CONTRACT = "0xA74Dad05f54d32575f82C3e065C4441b8d979a54"
DOGEOS_BLOCKSCOUT_URL = "https://blockscout.testnet.dogeos.com"


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
async def verify_nft_ownership(address: str, is_holder: str = "false"):
    """
    Verify NFT ownership and update player VIP status.
    Frontend should pass is_holder=True if wallet holds the NFT.
    Accepts is_holder as string "true"/"false" or boolean
    """
    try:
        # Parse is_holder - handle string "true"/"false" from query params
        if isinstance(is_holder, str):
            is_holder_bool = is_holder.lower() in ("true", "1", "yes")
        else:
            is_holder_bool = bool(is_holder)
        
        # Server-side blockchain verification as fallback
        # If frontend says not a holder, double-check on-chain for 0x addresses
        if not is_holder_bool and address.startswith("0x"):
            try:
                url = f"{DOGEOS_BLOCKSCOUT_URL}/api?module=account&action=tokenbalance&contractaddress={DOGEFOOD_NFT_CONTRACT}&address={address}"
                async with httpx.AsyncClient() as client:
                    resp = await client.get(url, timeout=10.0)
                    data = resp.json()
                if data.get("status") == "1" and data.get("result"):
                    nft_count = int(data.get("result", "0"))
                    if nft_count > 0:
                        is_holder_bool = True
                        logger.info(f"Server-side NFT check overrode frontend: {address} holds {nft_count} NFTs")
            except Exception as e:
                logger.warning(f"Server-side NFT check failed for {address}: {e}")
        
        logger.info(f"NFT verification for {address}: is_holder={is_holder} -> {is_holder_bool}")
        
        # Check if player exists
        existing_player = await db.players.find_one({"address": address})
        
        if is_holder_bool:
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
                    "id": str(uuid.uuid4()),
                    "address": address,
                    "nickname": None,
                    "is_nft_holder": True,
                    "is_vip": True,
                    "vip_bonus_claimed": True,
                    "points": 500,
                    "level": 1,
                    "experience": 0,
                    "created_treats": [],
                    "last_active": datetime.now(timezone.utc),
                    "leaderboard_eligible": True,
                    "can_convert_points": True
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
                    "last_active": datetime.now(timezone.utc)
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
        "generated_at": datetime.now(timezone.utc),
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
        
        # PERFORMANCE: Fetch player + recent treats ONCE upfront in parallel
        player_task = find_player_by_address(treat_data.creator_address)
        treats_task = db.treats.find({
            "creator_address": treat_data.creator_address,
            "created_at": {"$gte": datetime.now(timezone.utc) - timedelta(hours=24)}
        }).sort("created_at", -1).to_list(100)
        
        player, recent_treats_24h = await asyncio.gather(player_task, treats_task)
        
        # Anti-cheat validation — pass prefetched data to avoid re-querying
        cheat_check = await anti_cheat_system.validate_treat_creation(
            treat_data.creator_address,
            {"ingredients": treat_data.ingredients, "level": treat_data.player_level},
            prefetched_player=player,
            prefetched_treats_24h=recent_treats_24h
        )
        if not cheat_check["valid"]:
            daily_status = cheat_check.get("daily_status")
            error_detail = {
                "message": cheat_check['reason'],
                "daily_status": daily_status
            }
            raise HTTPException(status_code=429, detail=error_detail)
        
        # Run remaining DB operations in parallel, passing prefetched data
        extra_treat_task = anti_cheat_system.consume_extra_treat_if_needed(
            treat_data.creator_address, prefetched_player=player, prefetched_treats_24h=recent_treats_24h
        )
        streak_task = anti_cheat_system.update_player_streak(
            treat_data.creator_address, prefetched_player=player
        )
        
        extra_treat_consumed, streak_result = await asyncio.gather(extra_treat_task, streak_task)
        
        streak_bonus = streak_result.get("streak_bonus", {})
        xp_multiplier = streak_bonus.get("xp_multiplier", 1.0)
        brewing_reduction = streak_bonus.get("brewing_reduction", 0)  # percentage reduction
        
        # Get player's character bonus (Rex gives +15% rare chance)
        rare_chance_bonus = 0.0
        if player:
            selected_character = player.get("selected_character")
            character_bonuses = player.get("character_bonuses", {})
            
            # Rex: +15% rare treat chance
            if selected_character == "rex" or character_bonuses.get("rare_chance_bonus"):
                rare_chance_bonus = character_bonuses.get("rare_chance_bonus", 0.15)
                logger.info(f"🦖 Rex bonus: +{rare_chance_bonus*100}% rare chance for {treat_data.creator_address}")
        
        # ── Apply active heat event modifiers ─────────────────────────────
        heat_event_id = await arena_system.get_active_heat_event_id(db)
        heat_rare_bonus   = 0.0
        heat_timer_factor = 1.0  # multiplier on brewing time (1.0 = no change)

        if heat_event_id == "lab_surge":
            heat_rare_bonus = 0.10
            logger.info("🧪 Heat: Lab Surge — +10% rare chance active")
        elif heat_event_id == "crit_state":
            heat_rare_bonus = 0.20
            logger.info("🔴 Heat: Critical Mix — +20% rare chance active")
        elif heat_event_id == "overclock":
            heat_timer_factor = 0.50
            logger.info("⚡ Heat: Overclock Mode — brewing time halved")

        rare_chance_bonus = min(rare_chance_bonus + heat_rare_bonus, 0.60)  # cap at 60%

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
        
        # Apply Overclock heat event timer reduction (stacks with streak reduction)
        if heat_timer_factor < 1.0:
            original_timer = treat_outcome.get("timer_duration_seconds", 0)
            treat_outcome["timer_duration_seconds"] = max(60, int(original_timer * heat_timer_factor))
            treat_outcome["timer_duration_hours"] = treat_outcome["timer_duration_seconds"] / 3600
            treat_outcome["heat_time_reduction"] = original_timer - treat_outcome["timer_duration_seconds"]
            logger.info(f"⚡ Overclock applied: {original_timer}s → {treat_outcome['timer_duration_seconds']}s")

        # ── CRITICAL: Recalculate ready_at from the FINAL timer duration ──────
        # game_engine sets ready_at using the original timer before any reductions.
        # Streak and Overclock both update timer_duration_seconds but never fix
        # ready_at — so the brewing countdown runs to the wrong time.
        # Recalculate here so what's stored in DB matches the reduced timer.
        final_timer_seconds = treat_outcome.get("timer_duration_seconds", 3600)
        treat_outcome["ready_at"] = int(datetime.now(timezone.utc).timestamp()) + final_timer_seconds
        logger.info(f"✅ ready_at recalculated: now + {final_timer_seconds}s")

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
        now = datetime.now(timezone.utc)
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
            "created_at": datetime.now(timezone.utc),
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
        
        # Use player data already fetched earlier (avoid redundant DB call)
        if not player:
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
                "last_activity": datetime.now(timezone.utc)
            }
            # Use upsert to avoid duplicate key error if player was created
            # by update_player_streak (which runs in parallel with upsert=True)
            await db.players.update_one(
                {"address": treat_data.creator_address},
                {"$setOnInsert": player},
                upsert=True
            )
        
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
        
        # Run player update and daily status fetch in parallel
        # Pass prefetched player data to daily_status to avoid re-querying
        player_update_task = db.players.update_one(
            {"address": treat_data.creator_address},
            {
                "$push": {"created_treats": str(result.inserted_id)},
                "$set": {
                    "sack_progress": sack_progress,
                    "sack_completed_count": sack_completed_count, 
                    "total_treats_created": new_treats_count,
                    "last_activity": datetime.now(timezone.utc)
                },
                "$inc": {
                    "experience": sack_bonus_xp
                }
            }
        )
        # Recompute daily status using prefetched data + newly created treat
        daily_status_task = anti_cheat_system.get_daily_treat_status(
            treat_data.creator_address, prefetched_player=player
        )
        
        _, daily_status = await asyncio.gather(player_update_task, daily_status_task)
        
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
        
        # daily_status already fetched in parallel above
        
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
        
    except HTTPException:
        # Re-raise HTTPExceptions as-is (don't wrap in 500)
        raise
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
        "ingredients": [
            {
                "id": ing.id,
                "name": ing.name,
                "category": ing.category.value,
                "emoji": ing.emoji,
                "description": ing.description,
                "special_effect": ing.special_effect.value,
                "rarity_weight": ing.rarity_weight,
                "color": ing.color,
                "unlock_level": ing.unlock_level,
            }
            for ing in unlocked
        ],
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
            "registered_at": datetime.now(timezone.utc),
            "last_activity": datetime.now(timezone.utc)
        }
        
        result = await db.players.insert_one(player_data)
        
        return {
            "message": f"Player registered successfully with username: {username}",
            "player_id": str(result.inserted_id),
            "address": address,
            "username": username,
            "registered_at": datetime.now(timezone.utc).isoformat()
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
        # current_timestamp = int(datetime.now(timezone.utc).timestamp())
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
                "registered_at": existing_player.get("registered_at", datetime.now(timezone.utc)).isoformat()
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
            "registered_at": datetime.now(timezone.utc),
            "last_activity": datetime.now(timezone.utc)
        }
        
        result = await db.players.insert_one(player_data)
        
        return {
            "message": f"Telegram player registered successfully: {telegram_first_name or telegram_username}",
            "player_id": player_data["id"],
            "telegram_id": telegram_id,
            "username": telegram_username,
            "first_name": telegram_first_name,
            "auth_type": "telegram",
            "registered_at": datetime.now(timezone.utc).isoformat()
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
            "registered_at": datetime.now(timezone.utc),
            "last_activity": datetime.now(timezone.utc)
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
            "registered_at": datetime.now(timezone.utc).isoformat()
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
            "registered_at": datetime.now(timezone.utc),
            "last_activity": datetime.now(timezone.utc)
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
            "registered_at": datetime.now(timezone.utc).isoformat()
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
            "last_activity": datetime.now(timezone.utc),
            "wallet_linked_at": datetime.now(timezone.utc)
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
        
        # Cryptographically verify that whoever sent this request actually
        # controls `wallet_address` — without this, anyone could claim any
        # address was theirs just by sending a string in the request body.
        is_valid, error_reason = verify_wallet_signature(wallet_address, signature, message, telegram_id)
        if not is_valid:
            raise HTTPException(status_code=401, detail=f"Wallet signature verification failed: {error_reason}")
        
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
            "last_activity": datetime.now(timezone.utc),
            "wallet_signature": signature,
            "wallet_message": message,
            "wallet_linked_at": datetime.now(timezone.utc)
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
            "linked_at": datetime.now(timezone.utc).isoformat()
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
    # Include active heat event so the frontend can highlight bonus ingredients.
    # Import arena_system locally so this never fails if the module-level import
    # hasn't run yet (it lives at the bottom of this file).
    heat_event_id = "idle_calm"
    heat_event = None
    try:
        from services import arena_system as _arena
        heat_event_id = await _arena.get_active_heat_event_id(db)
        if heat_event_id and heat_event_id != "idle_calm":
            arena_doc = await db.arena_sessions.find_one(
                {"status": "active"}, {"_id": 0, "heat_event": 1}
            )
            if arena_doc and arena_doc.get("heat_event"):
                heat_event = arena_doc["heat_event"]
    except Exception:
        heat_event_id = "idle_calm"
        heat_event = None
    return {"ingredients": ingredients, "level": level, "heat_event_id": heat_event_id, "heat_event": heat_event}


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
        # Exponential scaling: 1h base, ~5.2h at level 10, capped at 12h
        timer_seconds = int(min(3600 * (1.2 ** (level - 1)), 12 * 3600))
        progression.append({
            "level": level,
            "timer_seconds": timer_seconds,
            "timer_hours": round(timer_seconds / 3600, 1),
            "timer_formatted": f"{timer_seconds // 3600}h {(timer_seconds % 3600) // 60}m"
        })
    return {"progression": progression}


@api_router.post("/game/simulate-outcome", dependencies=[Depends(verify_admin)])
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
    
    if not admin_key or admin_key != ADMIN_SECRET:
        await asyncio.sleep(2)  # Brute force protection
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
async def cleanup_test_players(admin_key: str = None):
    """Remove test players from the database - admin only"""
    
    if not admin_key or admin_key != ADMIN_SECRET:
        await asyncio.sleep(2)  # Brute force protection
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
@api_router.post("/admin/seasons/{season_id}/activate", dependencies=[Depends(verify_admin)])
async def activate_season(season_id: int):
    """Admin: Manually activate a season (requires admin key)"""
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
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "database": "connected",
            "current_season": current_season,
            "environment": "production" if "vercel" in os.getenv("VERCEL_URL", "") else "development"
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unavailable: {str(e)}")


# Root endpoint - Fast response for health checks
@app.get("/")
async def root():
    return {"status": "ok", "service": "DogeFood Lab API"}


# Detailed health check endpoint
@app.get("/health")
async def detailed_health():
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


class GrantLabBonusRequest(BaseModel):
    # Identify the player by whichever of these is known — nickname is
    # typically easiest since that's what's visible in-game/on Discord.
    nickname: Optional[str] = None
    telegram_username: Optional[str] = None
    address: Optional[str] = None
    amount: int
    reason: Optional[str] = None
    # Grant key: pass the same string again to make a repeat call a no-op
    # instead of stacking the bonus a second time (e.g. if this endpoint
    # is accidentally called twice for the same top-up).
    grant_key: str


@api_router.post("/admin/player/grant-lab-bonus")
async def grant_lab_bonus(payload: dict, admin_key: str = Query(...)):
    """
    Add a manual $LAB bonus on top of a player's live rank-based estimate
    (see calc_lab_reward / get_player_lab_estimate). This does NOT touch
    get_leaderboard() or anything the Leaderboard page reads — it only
    affects the lab-estimate endpoint that backs the MyTreats page and the
    Lab page's $LAB display.

    Idempotent: each grant is recorded under `grant_key` in the player's
    `lab_bonus_grants` list. Calling this again with the same grant_key
    is a no-op (returns the existing grant instead of adding twice) —
    safe to retry if a request times out or gets called twice by mistake.
    """
    if not admin_key or admin_key != ADMIN_SECRET:
        await asyncio.sleep(2)
        raise HTTPException(status_code=403, detail="Unauthorized: Invalid admin key")

    req = GrantLabBonusRequest(**payload)

    if not any([req.nickname, req.telegram_username, req.address]):
        raise HTTPException(status_code=400, detail="Provide nickname, telegram_username, or address to identify the player")

    # Resolve the player by whichever identifier was given.
    player = None
    if req.address:
        player = await find_player_by_address(req.address)
        # Support the UI's truncated display format, e.g. "TG_848...3476"
        # (shown when the full telegram_id doesn't fit on screen) — strip
        # the "TG_"/"tg_" prefix and the "..." middle, then match on
        # telegram_id by prefix+suffix digits instead of an exact value.
        if not player and isinstance(req.address, str) and "..." in req.address:
            raw = req.address.split("_", 1)[-1] if "_" in req.address else req.address
            prefix, _, suffix = raw.partition("...")
            prefix, suffix = prefix.strip(), suffix.strip()
            if prefix.isdigit() and suffix.isdigit():
                candidates = await db.players.find(
                    {"telegram_id": {"$exists": True, "$ne": None}},
                    {"telegram_id": 1, "id": 1, "nickname": 1, "lab_bonus_allocation": 1, "lab_bonus_grants": 1}
                ).to_list(5000)
                matches = [c for c in candidates
                           if str(c.get("telegram_id", "")).startswith(prefix)
                           and str(c.get("telegram_id", "")).endswith(suffix)]
                if len(matches) == 1:
                    player = matches[0]
                elif len(matches) > 1:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Truncated address matched {len(matches)} players — need the full telegram_id to disambiguate."
                    )
    if not player and req.nickname:
        # Case-insensitive exact match (anchored, not a substring search) —
        # a plain {"nickname": req.nickname} lookup is case-sensitive in
        # Mongo and silently misses if the stored casing differs at all
        # from what was typed (this was the original bug).
        import re as _re
        player = await db.players.find_one({
            "nickname": {"$regex": f"^{_re.escape(req.nickname)}$", "$options": "i"}
        })
    if not player and req.telegram_username:
        import re as _re
        player = await db.players.find_one({
            "telegram_username": {"$regex": f"^{_re.escape(req.telegram_username)}$", "$options": "i"}
        })

    if not player:
        raise HTTPException(status_code=404, detail="Player not found with the given identifier(s)")

    existing_grants = player.get("lab_bonus_grants") or []
    already_applied = next((g for g in existing_grants if g.get("grant_key") == req.grant_key), None)
    if already_applied:
        return {
            "success": True,
            "already_applied": True,
            "player_nickname": player.get("nickname"),
            "grant": already_applied,
            "new_total_bonus": player.get("lab_bonus_allocation", 0),
            "message": "This grant_key was already applied — no changes made (idempotent no-op)."
        }

    new_total_bonus = (player.get("lab_bonus_allocation") or 0) + req.amount
    grant_record = {
        "grant_key": req.grant_key,
        "amount": req.amount,
        "reason": req.reason,
        "granted_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.players.update_one(
        {"id": player["id"]},
        {
            "$set": {"lab_bonus_allocation": new_total_bonus},
            "$push": {"lab_bonus_grants": grant_record},
        }
    )

    logger.info(f"💰 Granted {req.amount:,} $LAB bonus to {player.get('nickname')} "
                f"(reason: {req.reason}) — new total bonus: {new_total_bonus:,}")

    return {
        "success": True,
        "already_applied": False,
        "player_nickname": player.get("nickname"),
        "grant": grant_record,
        "new_total_bonus": new_total_bonus,
        "message": f"Granted {req.amount:,} $LAB. Player's lab-estimate will now include this on top of their rank-based reward."
    }


@api_router.post("/admin/season2-reset")
async def season2_reset(admin_key: str = None):
    """
    Season 1 → Season 2 transition:
      1. Snapshot each player's current rank on the leaderboard
      2. Calculate their s1_lab_tokens using the same corrected formula as
         calc_lab_reward() / Leaderboard.jsx calcRewards():
           rank 1-10:  floor(6_000_000 * ((11 - rank) / 55) * 1.5)
           rank 11-20: floor(4_000_000 * ((21 - rank) / 55) * 0.21825)
           rank 21-50: floor(4_000_000 * ((51 - rank) / 465) * 0.0596046)
           rank 51+:   0
         (Multipliers corrected from the original 1.5/0.7/0.2 — those
         caused rank 11 to outpay rank 10 and rank 21 to outpay rank 20.
         See calc_lab_reward()'s docstring for the derivation.)
      3. Reset ALL players' points, experience and level to 0/1
      4. Preserve treats
    """
    if not admin_key or admin_key != ADMIN_SECRET:
        await asyncio.sleep(2)
        raise HTTPException(status_code=403, detail="Unauthorized: Invalid admin key")

    try:
        now = datetime.now(timezone.utc)

        # ── Mirror of Leaderboard.jsx constants ──────────────────────────
        SEASON_1_POOL = 20_000_000
        TOP10_POOL  = SEASON_1_POOL * 0.30   # 6 000 000
        TOP20_POOL  = SEASON_1_POOL * 0.20   # 4 000 000
        TOP50_POOL  = SEASON_1_POOL * 0.20   # 4 000 000

        def calc_rewards(rank: int) -> int:
            """Same formula/tiers as calc_lab_reward() above — kept as a
            local copy here since this admin script predates that helper
            and is only invoked once per season transition."""
            if rank <= 10:
                return int(TOP10_POOL * ((11 - rank) / 55) * _LAB_TIER1_MULT)
            if rank <= 20:
                return int(TOP20_POOL * ((21 - rank) / 55) * _LAB_TIER2_MULT)
            if rank <= 50:
                return int(TOP50_POOL * ((51 - rank) / 465) * _LAB_TIER3_MULT)
            return 0

        # ── 1. Build ranked leaderboard (same logic as /leaderboard) ─────
        active_addresses = await db.treats.distinct(
            "creator_address",
            {
                "brewing_status": "collected",
                "creator_address": {"$nin": [None, "", "GUEST_USER"]}
            }
        )

        ranked_players = []
        if active_addresses:
            ranked_players = await db.players.find(
                {"address": {"$in": active_addresses}, "points": {"$gt": 0}},
                {"_id": 0, "address": 1, "points": 1, "vip_bonus_claimed": 1}
            ).sort([("points", -1), ("level", -1)]).to_list(length=100000)

        # Apply same VIP-only skip as leaderboard endpoint
        ranked_players = [
            p for p in ranked_players
            if not (p.get("vip_bonus_claimed") and p.get("points", 0) <= 500)
        ]

        # ── 2. Write s1 snapshot + reset points/xp/level for ranked ──────
        players_with_lab = 0
        for idx, player in enumerate(ranked_players):
            rank = idx + 1
            addr = player["address"]
            pts  = player.get("points", 0)
            lab  = calc_rewards(rank)

            await db.players.update_one(
                {"address": addr},
                {"$set": {
                    "points":        0,
                    "experience":    0,
                    "level":         1,
                    "s1_points":     pts,
                    "s1_rank":       rank,
                    "s1_lab_tokens": lab,
                    "s1_settled_at": now.isoformat(),
                }}
            )
            if lab > 0:
                players_with_lab += 1

        # ── 3. Reset ALL remaining players (not on leaderboard) ───────────
        ranked_addrs = [p["address"] for p in ranked_players]
        await db.players.update_many(
            {"address": {"$nin": ranked_addrs}},
            {"$set": {
                "points":        0,
                "experience":    0,
                "level":         1,
                "s1_points":     0,
                "s1_rank":       None,
                "s1_lab_tokens": 0,
                "s1_settled_at": now.isoformat(),
            }}
        )

        # ── 4. Season markers ─────────────────────────────────────────────
        await db.seasons.update_one(
            {"season_id": 1},
            {"$set": {"status": "settled", "ended_at": now.isoformat()}},
            upsert=True
        )
        await db.seasons.update_one(
            {"season_id": 2},
            {"$set": {
                "season_id":  2,
                "name":       "Season 2 — Reactor",
                "status":     "active",
                "started_at": now.isoformat(),
            }},
            upsert=True
        )

        logger.info(
            f"🚀 SEASON 2 RESET — {len(ranked_players)} ranked reset, "
            f"{players_with_lab} players earned $LAB"
        )

        return {
            "success":          True,
            "message":          "🚀 Season 2 has begun! All points, XP and levels reset.",
            "ranked_players":   len(ranked_players),
            "players_with_lab": players_with_lab,
            "note":             "LAB amounts calculated from Leaderboard.jsx calcRewards()",
            "executed_at":      now.isoformat(),
        }

    except Exception as e:
        logger.error(f"Season 2 reset error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# SEASON 1 SNAPSHOT RECOVERY
# Re-applies s1_rank, s1_points, s1_lab_tokens for the top 19 players using
# the verified end-of-season-1 leaderboard values. Use dry_run=true first.
# ============================================================================

import re as _re_s1
from fastapi import Body

# rank -> {nickname_prefix, points, lab_tokens}
_SEASON1_TOP19 = [
    {"rank":  1, "prefix": "xpulga",    "points": 93320, "lab_tokens": 1636363},
    {"rank":  2, "prefix": "Rhino",     "points": 47491, "lab_tokens": 1472727},
    {"rank":  3, "prefix": "Ramzes",    "points": 45331, "lab_tokens": 1309090},
    {"rank":  4, "prefix": "The_",      "points": 34116, "lab_tokens": 1145454},
    {"rank":  5, "prefix": "Doginals",  "points": 30799, "lab_tokens":  981818},
    {"rank":  6, "prefix": "Giannib",   "points": 29730, "lab_tokens":  818181},
    {"rank":  7, "prefix": "YoWass",    "points": 29617, "lab_tokens":  654545},
    {"rank":  8, "prefix": "Tin_Fo",    "points": 26903, "lab_tokens":  490909},
    {"rank":  9, "prefix": "Sus",       "points": 24031, "lab_tokens":  327272},
    {"rank": 10, "prefix": "Lidlloh",   "points": 12062, "lab_tokens":  163636},
    {"rank": 11, "prefix": "TheZen",    "points":  7829, "lab_tokens":  509090},
    {"rank": 12, "prefix": "Jamaya",    "points":  7052, "lab_tokens":  458181},
    {"rank": 13, "prefix": "Herbalist", "points":  4782, "lab_tokens":  407272},
    {"rank": 14, "prefix": "Player",    "points":  3417, "lab_tokens":  356363},
    {"rank": 15, "prefix": "Vibing",    "points":  2762, "lab_tokens":  305454},
    {"rank": 16, "prefix": "DogFoo",    "points":  2368, "lab_tokens":  254545},
    {"rank": 17, "prefix": "Scienti",   "points":  2027, "lab_tokens":  203636},
    {"rank": 18, "prefix": "Cyberf",    "points":  1630, "lab_tokens":  152727},
    {"rank": 19, "prefix": "Queen",     "points":  1508, "lab_tokens":  101818},
]


@api_router.post("/admin/season1-restore-snapshot")
async def season1_restore_snapshot(
    admin_key: str = None,
    dry_run: bool = True,
    overrides: dict = Body(default={})
):
    """
    Recovery endpoint. Re-applies the Season 1 snapshot
    (s1_rank, s1_points, s1_lab_tokens) for the 19 verified top players.

    - admin_key: required, same ADMIN_SECRET as season2-reset.
    - dry_run:   true (default) returns the planned actions without writing.
                 Pass dry_run=false to actually update the documents.
    - overrides: { "<rank>": "<wallet_address>" } to force a specific wallet
                 when nickname matching is ambiguous. Example:
                 {"14": "0xabc...", "17": "0xdef..."}
    """
    if not admin_key or admin_key != ADMIN_SECRET:
        await asyncio.sleep(2)
        raise HTTPException(status_code=403, detail="Unauthorized: Invalid admin key")

    overrides = {int(k): v for k, v in (overrides or {}).items()}
    now = datetime.now(timezone.utc).isoformat()
    report = []

    for entry in _SEASON1_TOP19:
        rank   = entry["rank"]
        prefix = entry["prefix"]
        pts    = entry["points"]
        lab    = entry["lab_tokens"]

        forced_addr = overrides.get(rank)
        chosen = None

        if forced_addr:
            doc = await db.players.find_one({"address": forced_addr}, {"_id": 0, "address": 1, "nickname": 1})
            if not doc:
                report.append({
                    "rank": rank, "prefix": prefix,
                    "status": "OVERRIDE_NOT_FOUND",
                    "forced_address": forced_addr
                })
                continue
            chosen = doc
        else:
            regex = {"$regex": f"^{_re_s1.escape(prefix)}", "$options": "i"}
            candidates = await db.players.find(
                {"nickname": regex},
                {"_id": 0, "address": 1, "nickname": 1, "created_treats": 1}
            ).to_list(length=20)

            if not candidates:
                report.append({"rank": rank, "prefix": prefix, "status": "NO_MATCH"})
                continue

            if len(candidates) > 1:
                report.append({
                    "rank": rank, "prefix": prefix,
                    "status": "AMBIGUOUS",
                    "candidates": [
                        {
                            "address": c["address"],
                            "nickname": c.get("nickname"),
                            "treat_count": len(c.get("created_treats") or [])
                        }
                        for c in candidates
                    ],
                    "hint": f"Re-call with overrides={{\"{rank}\": \"<address>\"}}"
                })
                continue

            chosen = candidates[0]

        action = {
            "rank": rank,
            "prefix": prefix,
            "address": chosen["address"],
            "nickname": chosen.get("nickname"),
            "s1_points": pts,
            "s1_lab_tokens": lab,
            "status": "DRY_RUN" if dry_run else "UPDATED",
        }
        if not dry_run:
            await db.players.update_one(
                {"address": chosen["address"]},
                {"$set": {
                    "s1_rank":       rank,
                    "s1_points":     pts,
                    "s1_lab_tokens": lab,
                    "s1_settled_at": now,
                }}
            )
        report.append(action)

    summary = {
        "matched":   sum(1 for r in report if r["status"] in ("DRY_RUN", "UPDATED")),
        "no_match":  sum(1 for r in report if r["status"] == "NO_MATCH"),
        "ambiguous": sum(1 for r in report if r["status"] == "AMBIGUOUS"),
    }

    return {
        "success": True,
        "dry_run": dry_run,
        "executed_at": now,
        "summary": summary,
        "report": report,
        "hint": "If summary.matched == 19 in dry-run, re-call with ?dry_run=false to apply."
    }

@api_router.post("/admin/reset-leaderboard")
async def reset_leaderboard(admin_key: str = None):
    """
    Reset the leaderboard by clearing all player points.
    This marks the official start of Season 1.
    """
    if not admin_key or admin_key != ADMIN_SECRET:
        # Add delay to prevent brute force
        await asyncio.sleep(2)
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
            "started_at": datetime.now(timezone.utc),
            "end_date": datetime(2026, 3, 31, 23, 59, 59),  # Season 1 ends March 31, 2026
            "status": "active",
            "reset_at": datetime.now(timezone.utc)
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
            "season_started_at": datetime.now(timezone.utc).isoformat()
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
        
        now = datetime.now(timezone.utc)
        
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
# NOTIFICATION SYSTEM ENDPOINTS  (v2 — Web Push + Telegram)
# ============================================
#
# What this section does:
#   • Telegram notifications work via the existing python-telegram-bot library.
#     We additionally probe the bot+user once on subscribe so we can tell the
#     UI to surface a "Start bot" deep link if the user has never /start'd it.
#   • Browser notifications now use real Web Push (VAPID + service worker)
#     via the `pywebpush` library. Both MyDoge in-app browser and regular
#     browsers will show a native permission prompt and then receive pushes
#     even when the tab is closed.
#
# Required env vars (set on Render / your backend host):
#   VAPID_PUBLIC_KEY    = public VAPID key (URL-safe base64, raw form)
#   VAPID_PRIVATE_KEY   = matching private key (URL-safe base64)
#   VAPID_SUBJECT       = mailto:you@example.com  (or https://yoursite)
#   TELEGRAM_BOT_TOKEN  = existing bot token (already set)
#   TELEGRAM_BOT_USERNAME = bot username WITHOUT the @  (e.g. DogeFoodLabBot)
#
# Required dependency (add to requirements.txt):
#   pywebpush==2.0.0
#
# How to generate a VAPID key pair (one-time, locally):
#   pip install pywebpush
#   python -c "from py_vapid import Vapid01; v=Vapid01(); v.generate_keys();
#              print('PUBLIC:', v.public_pem().decode()); print('PRIVATE:', v.private_pem().decode())"
#   …or use https://web-push-codelab.glitch.me/ which gives the URL-safe
#   base64 form directly. You already provided the public key — re-generate
#   if you don't have the matching private key.

from pywebpush import webpush, WebPushException  # noqa: E402

VAPID_PUBLIC_KEY = os.environ.get(
    "VAPID_PUBLIC_KEY",
    "BAwws7g8riBGLvAQCHhCifyk1UKE0HL38SF6T9c_7NKZf8Ab5x2jUXxp8I8oJQEucSGe_sTiTG3mok47cwfCHCY",
)
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@dogefoodlab.com")
TELEGRAM_BOT_USERNAME = os.environ.get("TELEGRAM_BOT_USERNAME", "")


class NotificationSubscription(BaseModel):
    player_address: Optional[str] = None
    telegram_id: Optional[int] = None
    username: Optional[str] = None
    first_name: Optional[str] = None
    subscription: Optional[dict] = None
    treat_ready: bool = True
    limit_reset: bool = True


class ScheduleNotification(BaseModel):
    player_address: Optional[str] = None
    telegram_id: Optional[int] = None
    treat_name: Optional[str] = None
    ready_time: Optional[str] = None
    reset_time: Optional[str] = None


# ── Public config endpoint (consumed by NotificationContext on mount) ─────────
@api_router.get("/notifications/config")
async def get_notifications_config():
    return {
        "vapidPublicKey": VAPID_PUBLIC_KEY,
        "botUsername": TELEGRAM_BOT_USERNAME,
    }


# Kept for backwards compatibility with any old clients.
@api_router.get("/notifications/vapid-key")
async def get_vapid_key():
    return {"publicKey": VAPID_PUBLIC_KEY}


# ── Helpers ───────────────────────────────────────────────────────────────────
async def _try_send_telegram_welcome(telegram_id: int) -> bool:
    """Send the welcome message via Telegram. Returns False if the user
    has not /start'd the bot yet (Telegram refuses with 'Forbidden:
    bot can't initiate conversation with a user' in that case)."""
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not bot_token:
        return False
    try:
        bot = Bot(token=bot_token)
        await bot.send_message(
            chat_id=telegram_id,
            text=(
                "🔔 Notifications enabled!\n\n"
                "You'll be notified when:\n"
                "✅ Your treats are ready to collect\n"
                "🔄 Your daily limit resets\n\n"
                "Happy brewing! 🧪"
            ),
        )
        return True
    except Exception as e:
        logger.warning(f"Telegram welcome to {telegram_id} failed: {e}")
        return False


async def send_web_push(subscription_info: dict, title: str, body: str,
                        url: str = "/", icon: str = "/dogefood-logo.png") -> bool:
    """Send a Web Push notification. Returns False if the subscription
    is expired / invalid so the caller can mark it inactive."""
    if not VAPID_PRIVATE_KEY:
        logger.warning("VAPID_PRIVATE_KEY not configured — skipping web push")
        return False
    if not subscription_info or not subscription_info.get("endpoint"):
        return False

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url,
        "icon": icon,
    })

    try:
        # pywebpush is synchronous — run it in a thread so we don't block.
        await asyncio.to_thread(
            webpush,
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
        )
        return True
    except WebPushException as e:
        status = getattr(getattr(e, "response", None), "status_code", None)
        if status in (404, 410):
            # Subscription gone — caller should mark inactive.
            logger.info(f"Web push subscription expired (status {status})")
            return False
        logger.warning(f"WebPushException: {e}")
        return False
    except Exception as e:
        logger.error(f"send_web_push unexpected error: {e}")
        return False


# ── Telegram subscribe / unsubscribe / preferences ────────────────────────────
@api_router.post("/notifications/telegram/subscribe")
async def subscribe_telegram_notifications(data: NotificationSubscription):
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
                    "subscribed_at": datetime.now(timezone.utc),
                    "active": True,
                }
            },
            upsert=True,
        )

        # Probe whether the user has /start'd the bot — if yes, send welcome.
        # If not, return a flag so the UI can show "Open bot & press Start".
        delivered = await _try_send_telegram_welcome(data.telegram_id)

        return {
            "success": True,
            "message": "Telegram notifications enabled",
            "requires_bot_start": not delivered,
            "bot_username": TELEGRAM_BOT_USERNAME,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error subscribing to Telegram notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/notifications/telegram/unsubscribe")
async def unsubscribe_telegram_notifications(data: NotificationSubscription):
    try:
        if not data.telegram_id:
            raise HTTPException(status_code=400, detail="Telegram ID required")
        await db.notification_subscriptions.update_one(
            {"telegram_id": data.telegram_id},
            {"$set": {"active": False}},
        )
        return {"success": True, "message": "Telegram notifications disabled"}
    except Exception as e:
        logger.error(f"Error unsubscribing from Telegram notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/notifications/telegram/preferences")
async def update_telegram_preferences(data: NotificationSubscription):
    try:
        if not data.telegram_id:
            raise HTTPException(status_code=400, detail="Telegram ID required")
        await db.notification_subscriptions.update_one(
            {"telegram_id": data.telegram_id},
            {"$set": {"treat_ready": data.treat_ready, "limit_reset": data.limit_reset}},
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"Error updating Telegram preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Web Push subscribe / unsubscribe / preferences ────────────────────────────
@api_router.post("/notifications/web/subscribe")
async def subscribe_web_notifications(data: NotificationSubscription):
    try:
        if not data.player_address:
            raise HTTPException(status_code=400, detail="Player address required")

        update = {
            "player_address": data.player_address,
            "type": "web",
            "treat_ready": data.treat_ready,
            "limit_reset": data.limit_reset,
            "subscribed_at": datetime.now(timezone.utc),
            "active": True,
        }
        # subscription may be None for fallback in-tab Notification API users.
        if data.subscription:
            update["subscription"] = data.subscription

        await db.notification_subscriptions.update_one(
            {"player_address": data.player_address, "type": "web"},
            {"$set": update},
            upsert=True,
        )
        return {"success": True, "message": "Web push notifications enabled"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error subscribing to web notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/notifications/web/unsubscribe")
async def unsubscribe_web_notifications(data: NotificationSubscription):
    try:
        if not data.player_address:
            raise HTTPException(status_code=400, detail="Player address required")
        await db.notification_subscriptions.update_one(
            {"player_address": data.player_address, "type": "web"},
            {"$set": {"active": False}},
        )
        return {"success": True, "message": "Web push notifications disabled"}
    except Exception as e:
        logger.error(f"Error unsubscribing from web notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/notifications/web/preferences")
async def update_web_preferences(data: NotificationSubscription):
    try:
        if not data.player_address:
            raise HTTPException(status_code=400, detail="Player address required")
        await db.notification_subscriptions.update_one(
            {"player_address": data.player_address, "type": "web"},
            {"$set": {"treat_ready": data.treat_ready, "limit_reset": data.limit_reset}},
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"Error updating web preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Schedule endpoints (called from GameLab when a treat starts brewing) ──────
@api_router.post("/notifications/schedule/treat-ready")
async def schedule_treat_ready_notification(data: ScheduleNotification, background_tasks: BackgroundTasks):
    try:
        notification_data = {
            "id": str(uuid.uuid4()),
            "type": "treat_ready",
            "treat_name": data.treat_name,
            "ready_time": data.ready_time,
            "created_at": datetime.now(timezone.utc),
            "sent": False,
        }
        if data.telegram_id:
            notification_data["telegram_id"] = data.telegram_id
        elif data.player_address:
            notification_data["player_address"] = data.player_address
        else:
            raise HTTPException(status_code=400, detail="Telegram ID or player address required")

        await db.scheduled_notifications.insert_one(notification_data)
        background_tasks.add_task(send_scheduled_notification, notification_data["id"])
        return {"success": True, "notification_id": notification_data["id"]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scheduling treat notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/notifications/schedule/limit-reset")
async def schedule_limit_reset_notification(data: ScheduleNotification, background_tasks: BackgroundTasks):
    try:
        notification_data = {
            "id": str(uuid.uuid4()),
            "type": "limit_reset",
            "reset_time": data.reset_time,
            "created_at": datetime.now(timezone.utc),
            "sent": False,
        }
        if data.telegram_id:
            notification_data["telegram_id"] = data.telegram_id
        elif data.player_address:
            notification_data["player_address"] = data.player_address
        else:
            raise HTTPException(status_code=400, detail="Telegram ID or player address required")

        await db.scheduled_notifications.insert_one(notification_data)
        background_tasks.add_task(send_scheduled_notification, notification_data["id"])
        return {"success": True, "notification_id": notification_data["id"]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scheduling limit reset notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Delivery (now supports BOTH Telegram and Web Push) ────────────────────────
async def send_scheduled_notification(notification_id: str):
    """Send a single scheduled notification immediately if its target time has
    elapsed. Idempotent — marks `sent: True` after success."""
    try:
        notification = await db.scheduled_notifications.find_one({"id": notification_id})
        if not notification or notification.get("sent"):
            return

        # Compute whether this notification's target time has elapsed.
        now = datetime.now(timezone.utc)

        def parse_dt(value):
            if isinstance(value, str):
                dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            if hasattr(value, "tzinfo") and value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc)
            return value

        should_send = False
        if notification["type"] == "treat_ready" and notification.get("ready_time"):
            should_send = now >= parse_dt(notification["ready_time"])
        elif notification["type"] == "limit_reset" and notification.get("reset_time"):
            should_send = now >= parse_dt(notification["reset_time"])

        if not should_send:
            return  # processor loop will pick it up later

        # Build message text.
        if notification["type"] == "treat_ready":
            title = "🍖 Treat Ready!"
            body = (
                f"Your {notification.get('treat_name', 'treat')} is ready to collect — "
                f"head to the lab before it gets cold!"
            )
        else:
            title = "🔄 Daily Limit Reset"
            body = "You can create more treats now. Time to brew!"

        # ── Telegram delivery ───────────────────────────────────────────────
        if notification.get("telegram_id"):
            sub = await db.notification_subscriptions.find_one({
                "telegram_id": notification["telegram_id"],
                "active": True,
            })
            if not sub:
                await db.scheduled_notifications.update_one(
                    {"id": notification_id},
                    {"$set": {"sent": True, "skipped_reason": "subscription_inactive"}},
                )
                return

            if notification["type"] == "treat_ready" and not sub.get("treat_ready", True):
                await db.scheduled_notifications.update_one(
                    {"id": notification_id},
                    {"$set": {"sent": True, "skipped_reason": "preference_disabled"}},
                )
                return
            if notification["type"] == "limit_reset" and not sub.get("limit_reset", True):
                await db.scheduled_notifications.update_one(
                    {"id": notification_id},
                    {"$set": {"sent": True, "skipped_reason": "preference_disabled"}},
                )
                return

            bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
            if bot_token:
                try:
                    bot = Bot(token=bot_token)
                    await bot.send_message(chat_id=notification["telegram_id"], text=f"{title}\n\n{body}")
                    logger.info(f"📬 Telegram delivered: {notification_id}")
                except Exception as e:
                    logger.warning(f"Telegram send failed for {notification.get('telegram_id')}: {e}")
                    return  # don't mark sent, retry later

        # ── Web push delivery ───────────────────────────────────────────────
        elif notification.get("player_address"):
            sub = await db.notification_subscriptions.find_one({
                "player_address": notification["player_address"],
                "type": "web",
                "active": True,
            })
            if not sub:
                await db.scheduled_notifications.update_one(
                    {"id": notification_id},
                    {"$set": {"sent": True, "skipped_reason": "subscription_inactive"}},
                )
                return

            if notification["type"] == "treat_ready" and not sub.get("treat_ready", True):
                await db.scheduled_notifications.update_one(
                    {"id": notification_id},
                    {"$set": {"sent": True, "skipped_reason": "preference_disabled"}},
                )
                return
            if notification["type"] == "limit_reset" and not sub.get("limit_reset", True):
                await db.scheduled_notifications.update_one(
                    {"id": notification_id},
                    {"$set": {"sent": True, "skipped_reason": "preference_disabled"}},
                )
                return

            subscription_info = sub.get("subscription")
            if not subscription_info:
                # In-tab only fallback — there's no PushSubscription, so nothing
                # to send while the tab is closed. Mark sent.
                await db.scheduled_notifications.update_one(
                    {"id": notification_id},
                    {"$set": {"sent": True, "skipped_reason": "no_push_subscription"}},
                )
                return

            ok = await send_web_push(
                subscription_info,
                title=title,
                body=body,
                url="/lab",
            )
            if not ok:
                # Mark subscription inactive on expired/invalid endpoint
                await db.notification_subscriptions.update_one(
                    {"_id": sub["_id"]},
                    {"$set": {"active": False, "deactivated_reason": "push_failed"}},
                )
                await db.scheduled_notifications.update_one(
                    {"id": notification_id},
                    {"$set": {"sent": True, "skipped_reason": "push_failed"}},
                )
                return
            logger.info(f"📬 Web push delivered: {notification_id}")

        # Mark sent.
        await db.scheduled_notifications.update_one(
            {"id": notification_id},
            {"$set": {"sent": True, "sent_at": datetime.now(timezone.utc)}},
        )

    except Exception as e:
        logger.error(f"Error sending scheduled notification {notification_id}: {e}")


async def notification_processor_loop():
    """Background loop that checks for pending notifications every 30 seconds."""
    logger.info("🔔 Notification processor loop started (Telegram + Web Push)")

    while True:
        try:
            now = datetime.now(timezone.utc)

            pending = await db.scheduled_notifications.find({"sent": False}).to_list(200)

            for notif in pending:
                try:
                    target_str = notif.get("ready_time") if notif.get("type") == "treat_ready" else notif.get("reset_time")
                    if not target_str:
                        continue
                    if isinstance(target_str, str):
                        target = datetime.fromisoformat(target_str.replace("Z", "+00:00"))
                        if target.tzinfo is None:
                            target = target.replace(tzinfo=timezone.utc)
                    else:
                        target = target_str
                        if hasattr(target, "tzinfo") and target.tzinfo is None:
                            target = target.replace(tzinfo=timezone.utc)

                    if now >= target:
                        await send_scheduled_notification(notif["id"])
                except Exception as e:
                    logger.warning(f"Error processing notification {notif.get('id')}: {e}")

        except Exception as e:
            logger.error(f"Error in notification processor loop: {e}")

        await asyncio.sleep(30)


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
            "last_activity": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc),
            "daily_treats_count": 0,
            "daily_treats_last_reset": datetime.now(timezone.utc),
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


@api_router.post("/admin/delete-test-players", dependencies=[Depends(verify_admin)])
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
            # Season 2: Jun 17 – Sep 17 2026
            # Qualification runs all season; knockout bracket begins Sep 1 2026
            return {
                "id": "season2_championship",
                "name": "Treat Masters Champions League",
                "season": 2,
                "status": "qualification",
                "qualification_ends": "2026-09-01T00:00:00Z",
                "tournament_starts": "2026-09-01T00:00:00Z",
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
            "created_at": datetime.now(timezone.utc),
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
                "created_at": datetime.now(timezone.utc)
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
            {"$set": {"status": "active", "started_at": datetime.now(timezone.utc)}}
        )
        
        # Activate quarterfinal matches
        now = datetime.now(timezone.utc)
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
                "completed_at": datetime.now(timezone.utc)
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
                    "completed_at": datetime.now(timezone.utc)
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
        start_time = datetime.now(timezone.utc)
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
                "created_at": datetime.now(timezone.utc)
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
        now = datetime.now(timezone.utc)
        
        # Find active holder
        holder = await db.special_ingredient_holders.find_one({
            "is_active": True,
            "expires_at": {"$gt": now}
        }, {"_id": 0})
        
        if holder:
            # Calculate time remaining - use parse_utc_datetime helper
            expires_at = parse_utc_datetime(holder.get("expires_at"))
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
        now = datetime.now(timezone.utc)
        
        holder = await db.special_ingredient_holders.find_one({
            "player_address": address,
            "is_active": True,
            "expires_at": {"$gt": now}
        }, {"_id": 0})
        
        if holder:
            # Use parse_utc_datetime helper for proper timezone handling
            expires_at = parse_utc_datetime(holder.get("expires_at"))
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
        now = datetime.now(timezone.utc)
        
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
        # Must have a valid nickname to avoid "Anonymous" selections
        seven_days_ago = now - timedelta(days=7)
        
        active_players = await db.players.find({
            "last_active": {"$gte": seven_days_ago},
            "nickname": {"$exists": True, "$nin": [None, ""]},
            "$or": [
                {"address": {"$exists": True, "$nin": [None, ""]}},
                {"telegram_id": {"$exists": True, "$ne": None}}
            ]
        }).to_list(1000)
        
        # Fallback: get players with treats
        if not active_players:
            treat_creators = await db.treats.distinct("creator_address", {
                "created_at": {"$gte": seven_days_ago}
            })
            treat_creators = [addr for addr in treat_creators if addr]
            active_players = await db.players.find({
                "address": {"$in": treat_creators},
                "nickname": {"$exists": True, "$nin": [None, ""]}
            }).to_list(1000)
        
        # Final fallback: get any players with points and valid nickname
        if not active_players:
            active_players = await db.players.find({
                "points": {"$gt": 0},
                "nickname": {"$exists": True, "$nin": [None, ""]}
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
        now = datetime.now(timezone.utc)
        
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
        # Get current holder to determine next selection time
        current_holder = await db.special_ingredient_holders.find_one(
            {"is_active": True},
            sort=[("granted_at", -1)]
        )
        
        next_run = None
        if current_holder and current_holder.get("expires_at"):
            next_run = current_holder["expires_at"].isoformat() if isinstance(current_holder["expires_at"], datetime) else current_holder["expires_at"]
        
        return {
            "scheduler_running": background_task_started,
            "scheduler_type": "asyncio_background_task",
            "check_interval_hours": 1,
            "selection_interval_hours": 24,
            "ingredient_duration_hours": 16,
            "current_holder_expires": next_run
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
            {"$set": {"is_active": False, "expires_at": datetime.now(timezone.utc)}}
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


# =====================================================
# AUTO-MIXER SUBSCRIPTION ENDPOINTS
# =====================================================


@api_router.get("/auto-mixer/config")
async def get_auto_mixer_config():
    """Get auto-mixer configuration"""
    return {
        "monthly_fee_doge": AUTO_MIXER_CONFIG["monthly_fee_doge"],
        "max_window_hours": AUTO_MIXER_CONFIG["max_window_hours"],
        "min_window_hours": AUTO_MIXER_CONFIG["min_window_hours"],
        "payment_address": AUTO_MIXER_CONFIG["payment_address"],
        "buy_burn_percent": AUTO_MIXER_CONFIG["buy_burn_percent"],
        "dev_percent": AUTO_MIXER_CONFIG["dev_percent"],
        "mixes_per_hour": AUTO_MIXER_CONFIG["mixes_per_hour"]
    }


@api_router.post("/auto-mixer/create-subscription")
async def create_auto_mixer_subscription(request: AutoMixerCreateRequest):
    """Create a new auto-mixer subscription (pending payment)"""
    try:
        # Validate window hours
        if not (0 <= request.window_start_hour <= 23 and 0 <= request.window_end_hour <= 23):
            raise HTTPException(status_code=400, detail="Window hours must be between 0 and 23")
        
        # Calculate window duration
        if request.window_end_hour > request.window_start_hour:
            duration = request.window_end_hour - request.window_start_hour
        else:
            duration = (24 - request.window_start_hour) + request.window_end_hour
        
        if duration > AUTO_MIXER_CONFIG["max_window_hours"]:
            raise HTTPException(status_code=400, detail=f"Window cannot exceed {AUTO_MIXER_CONFIG['max_window_hours']} hours")
        
        if duration < AUTO_MIXER_CONFIG["min_window_hours"]:
            raise HTTPException(status_code=400, detail=f"Window must be at least {AUTO_MIXER_CONFIG['min_window_hours']} hour(s)")
        
        # Check for existing active subscription
        existing = await db.auto_mixer_subscriptions.find_one({
            "player_address": request.player_address,
            "status": {"$in": ["active", "pending"]}
        })
        
        if existing:
            if existing.get("status") == "active":
                raise HTTPException(status_code=400, detail="You already have an active subscription")
            # Return existing pending subscription
            existing["_id"] = str(existing["_id"]) if "_id" in existing else None
            return {"subscription": {k: v for k, v in existing.items() if k != "_id"}, "existing": True}
        
        # Get player nickname
        player = await db.players.find_one({"address": request.player_address})
        nickname = player.get("nickname") if player else None
        
        subscription_id = str(uuid.uuid4())
        
        # Generate unique payment amount to avoid collisions between orders
        base_fee = AUTO_MIXER_CONFIG["monthly_fee_doge"]
        unique_offset = round(random.randint(1, 99) / 1000, 3)
        unique_amount = round(base_fee + unique_offset, 3)
        
        # Ensure no other pending subscription has the same unique amount
        while await db.auto_mixer_subscriptions.find_one({"unique_amount": unique_amount, "status": "pending"}):
            unique_offset = round(random.randint(1, 99) / 1000, 3)
            unique_amount = round(base_fee + unique_offset, 3)
        
        subscription = {
            "id": subscription_id,
            "player_address": request.player_address,
            "player_nickname": nickname,
            "status": "pending",
            "subscription_start": None,
            "subscription_end": None,
            "window_start_hour": request.window_start_hour,
            "window_end_hour": request.window_end_hour,
            "payment_tx_hash": None,
            "payment_amount": base_fee,
            "unique_amount": unique_amount,
            "payment_confirmed": False,
            "payment_confirmations": 0,
            "total_auto_mixes": 0,
            "last_auto_mix": None,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.auto_mixer_subscriptions.insert_one(subscription)
        
        return {
            "subscription": {k: v for k, v in subscription.items() if k != "_id"},
            "payment_address": AUTO_MIXER_CONFIG["payment_address"],
            "payment_amount": unique_amount,
            "existing": False
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating auto-mixer subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# TATUM DOGE API - Auto Payment Detection
# =====================================================


async def get_address_transactions_tatum(payment_address: str, page_size: int = 50):
    """
    Get recent transactions for an address using Tatum API.
    Returns list of transactions with their details.
    """
    api_key = AUTO_MIXER_CONFIG.get("tatum_api_key", "")
    if not api_key:
        logger.warning("Tatum API key not configured")
        return []
    
    try:
        url = f"https://api.tatum.io/v3/dogecoin/transaction/address/{payment_address}"
        headers = {
            "x-api-key": api_key,
            "Accept": "application/json"
        }
        params = {"pageSize": page_size}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params, timeout=30.0)
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Tatum API error: {response.status_code} - {response.text[:200]}")
                return []
    except Exception as e:
        logger.error(f"Tatum get_address_transactions error: {e}")
        return []


async def get_transaction_details_tatum(tx_hash: str):
    """
    Get detailed transaction info using Tatum JSON-RPC API.
    Returns tx details including confirmations.
    """
    api_key = AUTO_MIXER_CONFIG.get("tatum_api_key", "")
    if not api_key:
        return None
    
    try:
        url = "https://dogecoin-mainnet.gateway.tatum.io/"
        headers = {
            "x-api-key": api_key,
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        payload = {
            "id": 1,
            "jsonrpc": "2.0",
            "method": "getrawtransaction",
            "params": [tx_hash, True]
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=30.0)
            
            if response.status_code == 200:
                data = response.json()
                if "result" in data:
                    return data["result"]
            return None
    except Exception as e:
        logger.error(f"Tatum get_transaction_details error: {e}")
        return None


async def check_and_activate_pending_payments():
    """
    Background task to check for incoming payments and auto-activate purchases.
    Uses Tatum v3 REST API data directly (outputs + blockNumber) to avoid extra RPC calls.
    Marks all seen transactions (matched or not) to avoid re-processing.
    """
    payment_address = AUTO_MIXER_CONFIG["payment_address"]
    required_confirmations = AUTO_MIXER_CONFIG["required_confirmations"]
    
    try:
        # Get recent transactions to the payment address
        transactions = await get_address_transactions_tatum(payment_address, 100)
        
        if not transactions:
            return {"checked": 0, "activated": 0}
        
        # Get current block height to calculate confirmations from blockNumber
        current_block = None
        if transactions and transactions[0].get("blockNumber"):
            current_block = max(tx.get("blockNumber", 0) for tx in transactions if tx.get("blockNumber"))
        
        activated_count = 0
        checked_count = 0
        skipped_count = 0
        
        for tx in transactions:
            tx_hash = tx.get("hash")
            if not tx_hash:
                continue
            
            checked_count += 1
            
            # Check if this tx is already processed (matched or seen)
            existing = await db.processed_payments.find_one({"tx_hash": tx_hash})
            if existing:
                skipped_count += 1
                continue
            
            # Calculate payment amount from Tatum v3 outputs directly
            payment_amount = 0
            for output in tx.get("outputs", []):
                if output.get("address") == payment_address:
                    payment_amount += float(output.get("value", 0))
            
            if payment_amount <= 0:
                # Not a payment TO us (might be outgoing tx) - mark as seen
                await db.processed_payments.insert_one({
                    "tx_hash": tx_hash,
                    "amount": 0,
                    "processed_at": datetime.now(timezone.utc),
                    "matched_order_type": "not_incoming",
                    "matched_order_id": None
                })
                continue
            
            # Calculate confirmations from blockNumber
            block_num = tx.get("blockNumber", 0)
            confirmations = (current_block - block_num + 1) if (current_block and block_num) else 0
            
            # If not enough confirmations yet, use JSON-RPC for precise count
            if confirmations < required_confirmations:
                tx_details = await get_transaction_details_tatum(tx_hash)
                if tx_details:
                    confirmations = tx_details.get("confirmations", 0)
                if confirmations < required_confirmations:
                    logger.info(f"TX {tx_hash[:16]}... has {confirmations} confirmations (need {required_confirmations}), skipping for now")
                    continue
            
            logger.info(f"New payment detected: {payment_amount} DOGE in TX {tx_hash[:20]}... ({confirmations} confirmations)")
            
            # Try to match this payment to a pending order
            activated = await match_and_activate_payment(tx_hash, payment_amount, confirmations)
            if activated:
                activated_count += 1
                # Mark tx as processed with match info
                await db.processed_payments.insert_one({
                    "tx_hash": tx_hash,
                    "amount": payment_amount,
                    "confirmations": confirmations,
                    "processed_at": datetime.now(timezone.utc),
                    "matched_order_type": activated.get("type"),
                    "matched_order_id": activated.get("order_id"),
                    "player_address": activated.get("player_address")
                })
            else:
                # Mark as seen but unmatched - will not re-check
                logger.warning(f"Unmatched payment: {payment_amount} DOGE in TX {tx_hash[:20]}... - no pending order found for this amount")
                await db.processed_payments.insert_one({
                    "tx_hash": tx_hash,
                    "amount": payment_amount,
                    "confirmations": confirmations,
                    "processed_at": datetime.now(timezone.utc),
                    "matched_order_type": "unmatched",
                    "matched_order_id": None
                })
        
        logger.info(f"Payment check: {checked_count} txs checked, {skipped_count} already seen, {activated_count} newly activated")
        return {"checked": checked_count, "activated": activated_count, "skipped": skipped_count}
        
    except Exception as e:
        logger.error(f"Error in check_and_activate_pending_payments: {e}")
        return {"checked": 0, "activated": 0, "error": str(e)}


async def match_and_activate_payment(tx_hash: str, amount: float, confirmations: int):
    """
    Try to match a payment to a pending order and activate it.
    Uses unique_amount field for precise matching (each order has a distinct amount).
    Falls back to base amount matching for legacy orders without unique_amount.
    """
    now = datetime.now(timezone.utc)
    tolerance = 0.05  # Wider tolerance so wallets that round to 2-3 decimal places still match
    
    # Filter to exclude test addresses
    real_address_filter = {
        "player_address": {"$not": {"$regex": "^(TEST_|test_|D_test_|TESTBOT_)"}}
    }
    
    # 1. Try unique amount matching (new orders have unique_amount).
    #    Tolerance of 0.05 handles wallet rounding to 2-3 decimal places.
    #    Also falls back to cost_doge floor in case player sent the round number.

    # Check extra life purchases by unique_amount
    pending_purchase = await db.extra_life_purchases.find_one(
        {
            "status": "pending",
            "unique_amount": {"$gte": amount - tolerance, "$lte": amount + tolerance},
            **real_address_filter
        },
        sort=[("created_at", 1)]
    )

    # Fallback: player sent the round cost_doge (e.g. 10.000 instead of 10.047)
    if not pending_purchase:
        pending_purchase = await db.extra_life_purchases.find_one(
            {
                "status": "pending",
                "cost_doge": {"$gte": amount - tolerance, "$lte": amount + tolerance},
                "unique_amount": {"$exists": True},
                **real_address_filter
            },
            sort=[("created_at", 1)]
        )
        if pending_purchase:
            logger.info(f"Extra life matched by cost_doge floor: sent {amount}, cost_doge {pending_purchase['cost_doge']}, unique_amount {pending_purchase.get('unique_amount')}")

    if pending_purchase:
        treats_to_grant = pending_purchase["treats_amount"]

        await db.extra_life_purchases.update_one(
            {"id": pending_purchase["id"]},
            {"$set": {
                "status": "completed",
                "payment_tx_hash": tx_hash,
                "payment_confirmed": True,
                "payment_confirmations": confirmations,
                "completed_at": now,
                "auto_activated": True
            }}
        )

        # Grant extra treats to player
        await db.players.update_one(
            {"address": pending_purchase["player_address"]},
            {
                "$inc": {"extra_treats_balance": treats_to_grant},
                "$push": {
                    "extra_life_history": {
                        "purchase_id": pending_purchase["id"],
                        "package_id": pending_purchase["package_id"],
                        "treats_granted": treats_to_grant,
                        "cost_doge": pending_purchase["cost_doge"],
                        "tx_hash": tx_hash,
                        "granted_at": now,
                        "auto_activated": True
                    }
                }
            },
            upsert=True
        )

        logger.info(f"Auto-activated extra life {pending_purchase['id']} for {pending_purchase['player_address']} (+{treats_to_grant} treats, TX: {tx_hash[:20]}...)")

        return {
            "type": "extra_life",
            "order_id": pending_purchase["id"],
            "player_address": pending_purchase["player_address"],
            "treats_granted": treats_to_grant
        }

    # Check subscriptions by unique_amount
    pending_sub = await db.auto_mixer_subscriptions.find_one(
        {
            "status": "pending",
            "unique_amount": {"$gte": amount - tolerance, "$lte": amount + tolerance},
            **real_address_filter
        },
        sort=[("created_at", 1)]
    )

    # Fallback: player sent the round monthly_fee_doge (e.g. 30.000 instead of 30.047)
    if not pending_sub:
        pending_sub = await db.auto_mixer_subscriptions.find_one(
            {
                "status": "pending",
                "payment_amount": {"$gte": amount - tolerance, "$lte": amount + tolerance},
                "unique_amount": {"$exists": True},
                **real_address_filter
            },
            sort=[("created_at", 1)]
        )
        if pending_sub:
            logger.info(f"Subscription matched by base fee floor: sent {amount}, unique_amount {pending_sub.get('unique_amount')}")
    
    if pending_sub:
        subscription_end = now + timedelta(days=30)
        await db.auto_mixer_subscriptions.update_one(
            {"id": pending_sub["id"]},
            {"$set": {
                "status": "active",
                "payment_tx_hash": tx_hash,
                "payment_confirmed": True,
                "payment_confirmations": confirmations,
                "payment_amount": amount,
                "subscription_start": now,
                "subscription_end": subscription_end,
                "activated_at": now,
                "auto_activated": True
            }}
        )
        
        logger.info(f"Auto-activated subscription {pending_sub['id']} for {pending_sub['player_address']} (TX: {tx_hash[:20]}...)")
        
        return {
            "type": "subscription",
            "order_id": pending_sub["id"],
            "player_address": pending_sub["player_address"]
        }
    
    # 2. FALLBACK: Legacy matching by base amount (for old orders without unique_amount)
    legacy_tolerance = 0.1
    
    subscription_amount = AUTO_MIXER_CONFIG["monthly_fee_doge"]
    extra_life_amounts = {pkg["cost_doge"]: pkg for pkg in EXTRA_LIFE_PACKAGES.values()}
    
    # Check subscription (30 DOGE range)
    if abs(amount - subscription_amount) <= legacy_tolerance:
        old_sub = await db.auto_mixer_subscriptions.find_one(
            {"status": "pending", "unique_amount": {"$exists": False}, **real_address_filter},
            sort=[("created_at", 1)]
        )
        if old_sub:
            subscription_end = now + timedelta(days=30)
            await db.auto_mixer_subscriptions.update_one(
                {"id": old_sub["id"]},
                {"$set": {
                    "status": "active",
                    "payment_tx_hash": tx_hash,
                    "payment_confirmed": True,
                    "payment_confirmations": confirmations,
                    "payment_amount": amount,
                    "subscription_start": now,
                    "subscription_end": subscription_end,
                    "activated_at": now,
                    "auto_activated": True
                }}
            )
            logger.info(f"Legacy-matched subscription {old_sub['id']} for {old_sub['player_address']}")
            return {"type": "subscription", "order_id": old_sub["id"], "player_address": old_sub["player_address"]}
    
    # Check extra life (10/20/35 DOGE range)
    for expected_amount, package in extra_life_amounts.items():
        if abs(amount - expected_amount) <= legacy_tolerance:
            old_purchase = await db.extra_life_purchases.find_one(
                {"status": "pending", "cost_doge": expected_amount, "unique_amount": {"$exists": False}, **real_address_filter},
                sort=[("created_at", 1)]
            )
            if old_purchase:
                treats_to_grant = old_purchase["treats_amount"]
                await db.extra_life_purchases.update_one(
                    {"id": old_purchase["id"]},
                    {"$set": {
                        "status": "completed",
                        "payment_tx_hash": tx_hash,
                        "payment_confirmed": True,
                        "payment_confirmations": confirmations,
                        "completed_at": now,
                        "auto_activated": True
                    }}
                )
                await db.players.update_one(
                    {"address": old_purchase["player_address"]},
                    {"$inc": {"extra_treats_balance": treats_to_grant}, "$push": {"extra_life_history": {"purchase_id": old_purchase["id"], "package_id": old_purchase["package_id"], "treats_granted": treats_to_grant, "cost_doge": expected_amount, "tx_hash": tx_hash, "granted_at": now, "auto_activated": True}}},
                    upsert=True
                )
                logger.info(f"Legacy-matched extra life {old_purchase['id']} for {old_purchase['player_address']}")
                return {"type": "extra_life", "order_id": old_purchase["id"], "player_address": old_purchase["player_address"], "treats_granted": treats_to_grant}
    
    return None


# Background task to run payment checks periodically
payment_check_running = False


async def payment_check_loop():
    """Background loop to check for payments every 30 seconds."""
    global payment_check_running
    payment_check_running = True
    
    # Wait a bit before starting to allow the app to fully initialize
    await asyncio.sleep(10)
    logger.info("💰 Payment check loop starting...")
    
    while payment_check_running:
        try:
            result = await check_and_activate_pending_payments()
            if result.get("activated", 0) > 0:
                logger.info(f"💰 Auto-activated {result['activated']} payment(s)")
        except Exception as e:
            logger.error(f"Payment check loop error: {e}")
        
        await asyncio.sleep(30)  # Check every 30 seconds


# Manual trigger endpoint for payment check
@api_router.post("/payments/check-pending")
async def trigger_payment_check():
    """Manually trigger a payment check (for testing or immediate updates)."""
    result = await check_and_activate_pending_payments()
    return result


@api_router.post("/payments/recheck-unmatched")
async def recheck_unmatched_payments():
    """Re-process previously unmatched payments. Call after new orders are created."""
    try:
        unmatched = await db.processed_payments.find(
            {"matched_order_type": "unmatched", "amount": {"$gt": 0}}
        ).to_list(length=100)
        
        reactivated = 0
        for payment in unmatched:
            tx_hash = payment["tx_hash"]
            amount = payment["amount"]
            confirmations = payment.get("confirmations", 1)
            
            activated = await match_and_activate_payment(tx_hash, amount, confirmations)
            if activated:
                reactivated += 1
                await db.processed_payments.update_one(
                    {"tx_hash": tx_hash},
                    {"$set": {
                        "matched_order_type": activated.get("type"),
                        "matched_order_id": activated.get("order_id"),
                        "player_address": activated.get("player_address"),
                        "rematched_at": datetime.now(timezone.utc)
                    }}
                )
                logger.info(f"Re-matched unmatched payment {tx_hash[:20]}... to {activated.get('type')} order")
        
        return {"unmatched_checked": len(unmatched), "reactivated": reactivated}
    except Exception as e:
        logger.error(f"Error rechecking unmatched payments: {e}")
        return {"error": str(e)}


# Admin endpoint to manually verify and credit a payment
@api_router.post("/payments/admin/verify-tx")
async def admin_verify_transaction(
    tx_hash: str,
    player_address: str,
    payment_type: str,  # "extra_life" or "subscription"
    package_id: str = "basic",  # For extra_life: basic, standard, premium
    admin_secret: str = Query(..., description="Admin secret key")
):
    """Admin endpoint to manually verify a transaction and credit the player."""
    # Verify admin secret
    expected_secret = os.environ.get("ADMIN_SECRET", "")
    if not expected_secret or admin_secret != expected_secret:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    try:
        # Get transaction details from Tatum
        tx_details = await get_transaction_details_tatum(tx_hash)
        if not tx_details:
            # Fallback to BlockCypher
            tx_data, confirmations, amount, error = await verify_doge_transaction_blockcypher(
                tx_hash, AUTO_MIXER_CONFIG["payment_address"]
            )
            if error:
                return {"success": False, "error": error}
        else:
            confirmations = tx_details.get("confirmations", 0)
            amount = 0
            for vout in tx_details.get("vout", []):
                addresses = vout.get("scriptPubKey", {}).get("addresses", [])
                if AUTO_MIXER_CONFIG["payment_address"] in addresses:
                    amount += float(vout.get("value", 0))
        
        if amount <= 0:
            return {"success": False, "error": "No payment found to our address in this transaction"}
        
        now = datetime.now(timezone.utc)
        
        if payment_type == "extra_life":
            if package_id not in EXTRA_LIFE_PACKAGES:
                return {"success": False, "error": f"Invalid package_id: {package_id}"}
            
            package = EXTRA_LIFE_PACKAGES[package_id]
            treats_to_grant = package["treats"]
            
            # Grant extra treats to player
            await db.players.update_one(
                {"address": player_address},
                {
                    "$inc": {"extra_treats_balance": treats_to_grant},
                    "$push": {
                        "extra_life_history": {
                            "purchase_id": f"admin_{tx_hash[:16]}",
                            "package_id": package_id,
                            "treats_granted": treats_to_grant,
                            "cost_doge": amount,
                            "tx_hash": tx_hash,
                            "granted_at": now,
                            "admin_granted": True
                        }
                    }
                },
                upsert=True
            )
            
            # Record the processed payment
            await db.processed_payments.insert_one({
                "tx_hash": tx_hash,
                "amount": amount,
                "confirmations": confirmations,
                "processed_at": now,
                "matched_order_type": "extra_life_admin",
                "player_address": player_address
            })
            
            return {
                "success": True,
                "message": f"Credited {treats_to_grant} extra treats to {player_address}",
                "tx_hash": tx_hash,
                "amount": amount,
                "confirmations": confirmations
            }
        
        elif payment_type == "subscription":
            subscription_end = now + timedelta(days=30)
            
            # Create or update subscription
            await db.auto_mixer_subscriptions.update_one(
                {"player_address": player_address, "status": "active"},
                {"$set": {
                    "status": "active",
                    "payment_tx_hash": tx_hash,
                    "payment_confirmed": True,
                    "payment_amount": amount,
                    "subscription_start": now,
                    "subscription_end": subscription_end,
                    "admin_activated": True
                }},
                upsert=True
            )
            
            return {
                "success": True,
                "message": f"Activated subscription for {player_address} until {subscription_end}",
                "tx_hash": tx_hash,
                "amount": amount
            }
        
        else:
            return {"success": False, "error": f"Invalid payment_type: {payment_type}"}
            
    except Exception as e:
        logger.error(f"Admin verify error: {e}")
        return {"success": False, "error": str(e)}


# Get pending orders for a player
@api_router.get("/payments/pending/{player_address}")
async def get_pending_payments(player_address: str):
    """Get all pending payments for a player."""
    pending_sub = await db.auto_mixer_subscriptions.find_one({
        "player_address": player_address,
        "status": "pending"
    })
    
    pending_extra_life = await db.extra_life_purchases.find_one({
        "player_address": player_address,
        "status": "pending"
    })
    
    return {
        "pending_subscription": {k: v for k, v in pending_sub.items() if k != "_id"} if pending_sub else None,
        "pending_extra_life": {k: v for k, v in pending_extra_life.items() if k != "_id"} if pending_extra_life else None,
        "payment_address": AUTO_MIXER_CONFIG["payment_address"],
        "subscription_cost": AUTO_MIXER_CONFIG["monthly_fee_doge"],
        "extra_life_packages": list(EXTRA_LIFE_PACKAGES.values())
    }


async def verify_doge_transaction_blockcypher(tx_hash: str, payment_address: str, api_key: str = None):
    """
    Verify DOGE transaction using BlockCypher API.
    This is the most reliable free DOGE API - no Cloudflare protection.
    """
    try:
        url = f"https://api.blockcypher.com/v1/doge/main/txs/{tx_hash}"
        params = {}
        if api_key:
            params["token"] = api_key
        
        # Use longer timeout and custom headers to appear more like a browser
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, headers=headers, timeout=60.0)
            
            if response.status_code == 404:
                return None, 0, 0, "Transaction not found"
            
            if response.status_code == 429:
                return None, 0, 0, "RATE_LIMITED"
            
            if response.status_code != 200:
                return None, 0, 0, f"API error: {response.status_code}"
            
            tx_data = response.json()
            
            confirmations = tx_data.get('confirmations', 0)
            payment_amount = 0
            payment_valid = False
            
            for output in tx_data.get('outputs', []):
                addresses = output.get('addresses', [])
                if payment_address in addresses:
                    payment_amount += output.get('value', 0) / 100000000
                    payment_valid = True
            
            if not payment_valid:
                return None, 0, 0, "Payment not sent to correct address"
            
            return tx_data, confirmations, payment_amount, None
            
    except httpx.TimeoutException:
        return None, 0, 0, "TIMEOUT"
    except Exception as e:
        logger.error(f"BlockCypher error: {str(e)}")
        return None, 0, 0, str(e)




async def verify_doge_transaction_via_address(tx_hash: str, payment_address: str, api_key: str = None):
    """
    Verify DOGE transaction by checking the address's transaction list.
    This is a more reliable fallback method - fetches recent txs for the address
    and checks if the given tx_hash exists with payment to the address.
    """
    try:
        # Get recent transactions for the payment address
        url = f"https://api.blockcypher.com/v1/doge/main/addrs/{payment_address}"
        params = {"limit": 50}  # Get last 50 transactions
        if api_key:
            params["token"] = api_key
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, headers=headers, timeout=60.0)
            
            if response.status_code == 429:
                return None, 0, 0, "RATE_LIMITED"
            
            if response.status_code != 200:
                return None, 0, 0, f"API error: {response.status_code}"
            
            data = response.json()
            
            # Search for the transaction in the address's history
            txrefs = data.get('txrefs', [])
            unconfirmed_txrefs = data.get('unconfirmed_txrefs', [])
            all_txs = txrefs + unconfirmed_txrefs
            
            for tx in all_txs:
                if tx.get('tx_hash') == tx_hash:
                    # Found the transaction!
                    confirmations = tx.get('confirmations', 0)
                    # Value is in satoshis, convert to DOGE
                    payment_amount = tx.get('value', 0) / 100000000
                    
                    # tx_input_n = -1 means this is an incoming transaction (output to this address)
                    if tx.get('tx_input_n', 0) == -1:
                        logger.info(f"Transaction verified via address lookup: {tx_hash}")
                        return {"tx_hash": tx_hash, "method": "address_lookup"}, confirmations, payment_amount, None
            
            return None, 0, 0, "Transaction not found in address history"
            
    except httpx.TimeoutException:
        return None, 0, 0, "TIMEOUT"
    except Exception as e:
        logger.error(f"Address lookup error: {str(e)}")
        return None, 0, 0, str(e)




async def verify_doge_transaction_with_fallback(tx_hash: str, payment_address: str, api_key: str = None):
    """
    Verify DOGE transaction using BlockCypher API with multiple methods.
    
    Strategy:
    1. Primary: Direct transaction lookup via BlockCypher
    2. Fallback: Address-based lookup (check if tx exists in address history)
    
    Note: SoChain and DogeChain are currently unreliable (502/403 errors)
    so we focus on BlockCypher which works reliably.
    """
    methods = [
        ("BlockCypher TX", lambda: verify_doge_transaction_blockcypher(tx_hash, payment_address, api_key)),
        ("BlockCypher Address", lambda: verify_doge_transaction_via_address(tx_hash, payment_address, api_key)),
    ]
    
    last_error = None
    
    for method_name, method_func in methods:
        for retry in range(3):  # Max 3 retries per method
            try:
                tx_data, confirmations, payment_amount, error = await method_func()
                
                if error == "RATE_LIMITED":
                    # Exponential backoff: 2s, 4s, 8s (longer waits)
                    wait_time = 2 * (2 ** retry)
                    logger.warning(f"{method_name} rate limited, waiting {wait_time}s before retry {retry + 1}/3")
                    await asyncio.sleep(wait_time)
                    continue
                
                if error == "TIMEOUT":
                    # Retry on timeout
                    wait_time = 1 * (retry + 1)
                    logger.warning(f"{method_name} timed out, waiting {wait_time}s before retry {retry + 1}/3")
                    await asyncio.sleep(wait_time)
                    continue
                
                if error is None:
                    # Success!
                    logger.info(f"Transaction verified via {method_name}: {tx_hash}")
                    return tx_data, confirmations, payment_amount, None
                
                if "not found" in error.lower():
                    # Transaction doesn't exist in this method - try next method
                    last_error = error
                    break
                
                # Other error - try next method
                last_error = f"{method_name}: {error}"
                break
                
            except Exception as e:
                logger.error(f"{method_name} unexpected error: {str(e)}")
                last_error = f"{method_name}: {str(e)}"
                break
        
        # If we exhausted retries due to rate limiting or timeout, continue to next method
        if error in ["RATE_LIMITED", "TIMEOUT"]:
            logger.warning(f"{method_name} exhausted retries, trying next method")
            continue
    
    # All methods failed
    return None, 0, 0, last_error or "Transaction verification failed. Please ensure the transaction hash is correct and try again."


@api_router.post("/auto-mixer/verify-payment")
async def verify_auto_mixer_payment(request: AutoMixerPaymentVerifyRequest):
    """Verify payment for auto-mixer subscription using multiple DOGE APIs with fallback"""
    try:
        # Find the subscription
        subscription = await db.auto_mixer_subscriptions.find_one({
            "id": request.subscription_id,
            "status": "pending"
        })
        
        if not subscription:
            raise HTTPException(status_code=404, detail="Subscription not found or not pending")
        
        # Check if this tx_hash was already verified and cached
        cached_verification = await db.tx_verifications.find_one({"tx_hash": request.tx_hash})
        if cached_verification:
            # Use cached result
            confirmations = cached_verification.get("confirmations", 0)
            payment_amount = cached_verification.get("payment_amount", 0)
            logger.info(f"Using cached verification for {request.tx_hash}")
        else:
            # Verify the transaction using multiple APIs with fallback
            api_key = AUTO_MIXER_CONFIG.get("blockcypher_api_key", "")
            
            tx_data, confirmations, payment_amount, error = await verify_doge_transaction_with_fallback(
                request.tx_hash,
                AUTO_MIXER_CONFIG["payment_address"],
                api_key
            )
            
            if error:
                # Provide user-friendly error message
                if "rate" in error.lower() or "429" in error:
                    raise HTTPException(
                        status_code=503, 
                        detail="Verification services are busy. Please wait 30 seconds and try again."
                    )
                raise HTTPException(status_code=400, detail=error)
            
            # Cache successful verification
            await db.tx_verifications.update_one(
                {"tx_hash": request.tx_hash},
                {"$set": {
                    "tx_hash": request.tx_hash,
                    "confirmations": confirmations,
                    "payment_amount": payment_amount,
                    "payment_address": AUTO_MIXER_CONFIG["payment_address"],
                    "verified_at": datetime.now(timezone.utc)
                }},
                upsert=True
            )
        
        if payment_amount < AUTO_MIXER_CONFIG["monthly_fee_doge"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Payment amount insufficient. Required: {AUTO_MIXER_CONFIG['monthly_fee_doge']} DOGE, Received: {payment_amount} DOGE"
            )
        
        # Update subscription
        now = datetime.now(timezone.utc)
        update_data = {
            "payment_tx_hash": request.tx_hash,
            "payment_confirmations": confirmations,
            "updated_at": now
        }
        
        # If enough confirmations, activate the subscription
        if confirmations >= AUTO_MIXER_CONFIG["required_confirmations"]:
            update_data["status"] = "active"
            update_data["payment_confirmed"] = True
            update_data["subscription_start"] = now
            update_data["subscription_end"] = now + timedelta(days=30)
            
            # Record the payment for funds tracking
            await db.auto_mixer_payments.insert_one({
                "id": str(uuid.uuid4()),
                "subscription_id": request.subscription_id,
                "player_address": subscription["player_address"],
                "tx_hash": request.tx_hash,
                "amount_doge": payment_amount,
                "buy_burn_amount": payment_amount * (AUTO_MIXER_CONFIG["buy_burn_percent"] / 100),
                "dev_amount": payment_amount * (AUTO_MIXER_CONFIG["dev_percent"] / 100),
                "confirmed_at": now,
                "created_at": now
            })
        
        await db.auto_mixer_subscriptions.update_one(
            {"id": request.subscription_id},
            {"$set": update_data}
        )
        
        # Get updated subscription
        updated_sub = await db.auto_mixer_subscriptions.find_one({"id": request.subscription_id}, {"_id": 0})
        
        return {
            "subscription": updated_sub,
            "confirmations": confirmations,
            "required_confirmations": AUTO_MIXER_CONFIG["required_confirmations"],
            "payment_amount": payment_amount,
            "is_confirmed": confirmations >= AUTO_MIXER_CONFIG["required_confirmations"]
        }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying payment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/auto-mixer/subscription/{player_address}")
async def get_auto_mixer_subscription(player_address: str):
    """Get player's auto-mixer subscription"""
    try:
        subscription = await db.auto_mixer_subscriptions.find_one({
            "player_address": player_address,
            "status": {"$in": ["active", "pending"]}
        }, {"_id": 0})
        
        if subscription:
            now = datetime.now(timezone.utc)
            
            # Handle subscription_end as string or datetime — always normalize
            sub_end = subscription.get("subscription_end")
            if sub_end:
                try:
                    sub_end = parse_utc_datetime(sub_end)
                except Exception:
                    sub_end = None
                
                if sub_end and subscription.get("status") == "active":
                    if sub_end <= now:
                        # Subscription has expired — update status
                        await db.auto_mixer_subscriptions.update_one(
                            {"id": subscription["id"]},
                            {"$set": {"status": "expired", "updated_at": now}}
                        )
                        subscription["status"] = "expired"
                    else:
                        # Calculate days remaining and expiry warning
                        remaining_delta = sub_end - now
                        days_remaining = remaining_delta.days
                        subscription["days_remaining"] = days_remaining
                        subscription["expiring_soon"] = days_remaining <= 5
                        subscription["expires_at"] = sub_end.isoformat()
        
        return {"subscription": subscription, "has_subscription": subscription is not None}
        
    except Exception as e:
        logger.error(f"Error fetching subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/auto-mixer/update-window")
async def update_auto_mixer_window(request: AutoMixerWindowUpdateRequest):
    """Update the mixing window for an active subscription"""
    try:
        # Validate window hours
        if not (0 <= request.window_start_hour <= 23 and 0 <= request.window_end_hour <= 23):
            raise HTTPException(status_code=400, detail="Window hours must be between 0 and 23")
        
        # Calculate window duration
        if request.window_end_hour > request.window_start_hour:
            duration = request.window_end_hour - request.window_start_hour
        else:
            duration = (24 - request.window_start_hour) + request.window_end_hour
        
        if duration > AUTO_MIXER_CONFIG["max_window_hours"]:
            raise HTTPException(status_code=400, detail=f"Window cannot exceed {AUTO_MIXER_CONFIG['max_window_hours']} hours")
        
        # Find and verify ownership
        subscription = await db.auto_mixer_subscriptions.find_one({
            "id": request.subscription_id,
            "player_address": request.player_address,
            "status": "active"
        })
        
        if not subscription:
            raise HTTPException(status_code=404, detail="Active subscription not found")
        
        # Update window
        await db.auto_mixer_subscriptions.update_one(
            {"id": request.subscription_id},
            {"$set": {
                "window_start_hour": request.window_start_hour,
                "window_end_hour": request.window_end_hour,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        updated_sub = await db.auto_mixer_subscriptions.find_one({"id": request.subscription_id}, {"_id": 0})
        
        return {"subscription": updated_sub, "message": "Window updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating window: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/auto-mixer/cancel/{subscription_id}")
async def cancel_auto_mixer_subscription(subscription_id: str, player_address: str):
    """Cancel an auto-mixer subscription"""
    try:
        subscription = await db.auto_mixer_subscriptions.find_one({
            "id": subscription_id,
            "player_address": player_address
        })
        
        if not subscription:
            raise HTTPException(status_code=404, detail="Subscription not found")
        
        await db.auto_mixer_subscriptions.update_one(
            {"id": subscription_id},
            {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc)}}
        )
        
        return {"message": "Subscription cancelled successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/auto-mixer/funds-stats")
async def get_auto_mixer_funds_stats():
    """Get real-time funds statistics for auto-mixer"""
    try:
        # Get total payments
        pipeline = [
            {"$group": {
                "_id": None,
                "total_received": {"$sum": "$amount_doge"},
                "buy_burn_total": {"$sum": "$buy_burn_amount"},
                "dev_total": {"$sum": "$dev_amount"},
                "count": {"$sum": 1}
            }}
        ]
        
        result = await db.auto_mixer_payments.aggregate(pipeline).to_list(1)
        
        # Get subscriber counts
        total_subs = await db.auto_mixer_subscriptions.count_documents({})
        active_subs = await db.auto_mixer_subscriptions.count_documents({"status": "active"})
        
        # Get total auto mixes
        mix_pipeline = [
            {"$match": {"status": "active"}},
            {"$group": {"_id": None, "total_mixes": {"$sum": "$total_auto_mixes"}}}
        ]
        mix_result = await db.auto_mixer_subscriptions.aggregate(mix_pipeline).to_list(1)
        
        stats = result[0] if result else {}
        mix_stats = mix_result[0] if mix_result else {}
        
        return {
            "total_received_doge": round(stats.get("total_received", 0), 2),
            "buy_burn_amount": round(stats.get("buy_burn_total", 0), 2),
            "dev_amount": round(stats.get("dev_total", 0), 2),
            "total_subscribers": total_subs,
            "active_subscribers": active_subs,
            "total_auto_mixes": mix_stats.get("total_mixes", 0),
            "buy_burn_percent": AUTO_MIXER_CONFIG["buy_burn_percent"],
            "dev_percent": AUTO_MIXER_CONFIG["dev_percent"]
        }
        
    except Exception as e:
        logger.error(f"Error fetching funds stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/auto-mixer/history/{player_address}")
async def get_auto_mixer_history(player_address: str, limit: int = 20):
    """Get auto-mix history for a player"""
    try:
        history = await db.auto_mix_history.find(
            {"player_address": player_address}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        # Remove MongoDB _id
        for item in history:
            item.pop("_id", None)
        
        return {"history": history}
        
    except Exception as e:
        logger.error(f"Error fetching auto-mix history: {e}")
        raise HTTPException(status_code=500, detail=str(e))




@api_router.get("/auto-mixer/debug-subscriptions")
async def debug_subscriptions(admin_secret: str = Query(..., description="Admin secret key")):
    """Debug endpoint to see all subscription data - Admin only"""
    # Verify admin secret
    expected_secret = os.environ.get("ADMIN_SECRET", "")
    if not expected_secret or admin_secret != expected_secret:
        raise HTTPException(status_code=403, detail="Unauthorized - Invalid admin secret")
    
    try:
        now = datetime.now(timezone.utc)
        
        # Get all subscriptions
        all_subs = await db.auto_mixer_subscriptions.find({}).sort("created_at", -1).limit(50).to_list(50)
        
        debug_info = []
        for sub in all_subs:
            sub_end = sub.get("subscription_end")
            sub_end_parsed = None
            is_active_now = False
            
            if sub_end:
                try:
                    sub_end_aware = parse_utc_datetime(sub_end)
                    sub_end_parsed = sub_end_aware.isoformat()
                    is_active_now = sub_end_aware > now
                except Exception:
                    sub_end_parsed = str(sub_end)
            
            debug_info.append({
                "id": sub.get("id"),
                "player_address": sub.get("player_address", "")[:20] + "...",
                "status": sub.get("status"),
                "subscription_end_raw": str(sub_end),
                "subscription_end_type": type(sub_end).__name__,
                "subscription_end_parsed": sub_end_parsed,
                "is_active_now": is_active_now,
                "created_at": str(sub.get("created_at")),
                "total_auto_mixes": sub.get("total_auto_mixes", 0)
            })
        
        return {
            "current_time_utc": now.isoformat(),
            "total_in_db": await db.auto_mixer_subscriptions.count_documents({}),
            "status_active": await db.auto_mixer_subscriptions.count_documents({"status": "active"}),
            "subscriptions": debug_info
        }
        
    except Exception as e:
        logger.error(f"Debug subscriptions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))




@api_router.get("/auto-mixer/agent-status")
async def get_auto_mixer_agent_status():
    """Get detailed status of the auto-mixer agent"""
    try:
        now = datetime.now(timezone.utc)
        
        # Get all active subscriptions - handle both datetime objects and ISO strings
        # First try to get all active status subscriptions
        all_active = await db.auto_mixer_subscriptions.find({
            "status": "active"
        }).to_list(1000)
        
        # Filter by subscription_end manually to handle different date formats
        active_subs = []
        for sub in all_active:
            sub_end = sub.get("subscription_end")
            if sub_end:
                # Always normalize to UTC-aware datetime
                try:
                    sub_end = parse_utc_datetime(sub_end)
                except Exception:
                    continue
                if sub_end > now:
                    active_subs.append(sub)
            else:
                # If no end date, include it (might be lifetime or error)
                active_subs.append(sub)
        
        # Calculate subscribers currently in their window
        current_hour = now.hour
        in_window_count = 0
        
        for sub in active_subs:
            start_hour = sub.get("window_start_hour", 0)
            end_hour = sub.get("window_end_hour", 6)
            
            if start_hour < end_hour:
                if start_hour <= current_hour < end_hour:
                    in_window_count += 1
            else:  # Window crosses midnight
                if current_hour >= start_hour or current_hour < end_hour:
                    in_window_count += 1
        
        # Get recent mix activity (last 24 hours)
        yesterday = now - timedelta(hours=24)
        recent_mixes = await db.auto_mix_history.find({
            "created_at": {"$gte": yesterday}
        }).to_list(1000)
        
        # Calculate stats
        mixes_last_24h = len(recent_mixes)
        mixes_last_hour = len([m for m in recent_mixes if (now - parse_utc_datetime(m.get("created_at", now))).total_seconds() < 3600])
        
        # Rarity breakdown of recent mixes
        rarity_breakdown = {"Starter": 0, "Common": 0, "Uncommon": 0, "Rare": 0, "Epic": 0, "Legendary": 0, "Mythic": 0}
        total_points = 0
        total_xp = 0
        
        for mix in recent_mixes:
            rarity = mix.get("treat_rarity", "Common")
            if rarity in rarity_breakdown:
                rarity_breakdown[rarity] += 1
            total_points += mix.get("points_earned", 0)
            total_xp += mix.get("xp_earned", 0)
        
        # Get most used ingredients (last 7 days)
        week_ago = now - timedelta(days=7)
        weekly_mixes = await db.auto_mix_history.find({
            "created_at": {"$gte": week_ago}
        }).to_list(5000)
        
        ingredient_counts = {}
        for mix in weekly_mixes:
            for ing in mix.get("ingredients", []):
                ingredient_counts[ing] = ingredient_counts.get(ing, 0) + 1
        
        # Get top 10 ingredients with names
        top_ingredients = sorted(ingredient_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        
        # Map ingredient IDs to names
        top_ingredients_with_names = []
        for ing_id, count in top_ingredients:
            ing_data = ingredient_system.get_ingredient(ing_id)
            ing_name = ing_data.name if ing_data else ing_id
            ing_emoji = ing_data.emoji if ing_data else "🧪"
            top_ingredients_with_names.append({
                "ingredient_id": ing_id,
                "name": ing_name,
                "emoji": ing_emoji,
                "usage_count": count
            })
        
        # Get next scheduled run info
        next_run_minutes = 30 - (now.minute % 30)
        next_run_time = now + timedelta(minutes=next_run_minutes)
        
        return {
            "agent_status": "ACTIVE",
            "current_time_utc": now.isoformat(),
            "current_hour_utc": current_hour,
            "next_run_time_utc": next_run_time.isoformat(),
            "run_interval_minutes": 30,
            "mixes_per_hour_config": AUTO_MIXER_CONFIG["mixes_per_hour"],
            "subscribers": {
                "total_active": len(active_subs),
                "currently_in_window": in_window_count,
                "outside_window": len(active_subs) - in_window_count
            },
            "activity_24h": {
                "total_mixes": mixes_last_24h,
                "mixes_last_hour": mixes_last_hour,
                "total_points_awarded": total_points,
                "total_xp_awarded": total_xp,
                "avg_mixes_per_hour": round(mixes_last_24h / 24, 1) if mixes_last_24h > 0 else 0
            },
            "rarity_distribution_24h": rarity_breakdown,
            "top_ingredients_7d": top_ingredients_with_names,
            "performance": {
                "uptime_status": "healthy",
                "last_error": None
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching agent status: {e}")
        raise HTTPException(status_code=500, detail=str(e))




@api_router.get("/auto-mixer/detailed-stats/{player_address}")
async def get_auto_mixer_detailed_stats(player_address: str):
    """Get detailed auto-mixer stats for a specific player"""
    try:
        now = datetime.now(timezone.utc)
        
        # Get player's subscription
        subscription = await db.auto_mixer_subscriptions.find_one({
            "player_address": player_address,
            "status": "active"
        }, {"_id": 0})
        
        if not subscription:
            return {
                "has_subscription": False,
                "message": "No active subscription found"
            }
        
        # Get player's mix history
        all_history = await db.auto_mix_history.find({
            "player_address": player_address
        }).sort("created_at", -1).to_list(1000)
        
        # Calculate time-based stats
        last_24h = [m for m in all_history if (now - m.get("created_at", now)).total_seconds() < 86400]
        last_7d = [m for m in all_history if (now - m.get("created_at", now)).total_seconds() < 604800]
        
        # Rarity breakdown (all time)
        rarity_counts = {"Starter": 0, "Common": 0, "Uncommon": 0, "Rare": 0, "Epic": 0, "Legendary": 0, "Mythic": 0}
        total_points = 0
        total_xp = 0
        ingredient_usage = {}
        
        for mix in all_history:
            rarity = mix.get("treat_rarity", "Common")
            if rarity in rarity_counts:
                rarity_counts[rarity] += 1
            total_points += mix.get("points_earned", 0)
            total_xp += mix.get("xp_earned", 0)
            
            for ing in mix.get("ingredients", []):
                ingredient_usage[ing] = ingredient_usage.get(ing, 0) + 1
        
        # Best rarity found
        best_rarity = "None"
        rarity_order = ["Mythic", "Legendary", "Epic", "Rare", "Uncommon", "Common"]
        for r in rarity_order:
            if rarity_counts.get(r, 0) > 0:
                best_rarity = r
                break
        
        # Calculate window info
        start_hour = subscription.get("window_start_hour", 0)
        end_hour = subscription.get("window_end_hour", 6)
        current_hour = now.hour
        
        if start_hour < end_hour:
            in_window = start_hour <= current_hour < end_hour
            window_hours = end_hour - start_hour
        else:
            in_window = current_hour >= start_hour or current_hour < end_hour
            window_hours = (24 - start_hour) + end_hour
        
        # Calculate subscription progress — handle string dates
        sub_start = subscription.get("subscription_start")
        sub_end = subscription.get("subscription_end")
        if sub_start and isinstance(sub_start, str):
            try:
                sub_start = parse_utc_datetime(sub_start)
            except Exception:
                sub_start = None
        if sub_end and isinstance(sub_end, str):
            try:
                sub_end = parse_utc_datetime(sub_end)
            except Exception:
                sub_end = None
        
        if sub_start and sub_end:
            if sub_end <= now:
                # Subscription expired — update status
                await db.auto_mixer_subscriptions.update_one(
                    {"id": subscription.get("id")},
                    {"$set": {"status": "expired", "updated_at": now}}
                )
                return {"has_subscription": False, "expired": True, "message": "Subscription has expired"}
            total_duration = (sub_end - sub_start).total_seconds()
            elapsed = (now - sub_start).total_seconds()
            days_remaining = max(0, (sub_end - now).days)
            progress_percent = min(100, (elapsed / total_duration) * 100)
        else:
            days_remaining = 0
            progress_percent = 0
        
        # Daily breakdown for last 7 days
        daily_stats = {}
        for i in range(7):
            day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            daily_stats[day] = {"mixes": 0, "points": 0, "xp": 0}
        
        for mix in last_7d:
            created = mix.get("created_at")
            if created:
                day = created.strftime("%Y-%m-%d")
                if day in daily_stats:
                    daily_stats[day]["mixes"] += 1
                    daily_stats[day]["points"] += mix.get("points_earned", 0)
                    daily_stats[day]["xp"] += mix.get("xp_earned", 0)
        
        # Most recent mixes
        recent_mixes = []
        for mix in all_history[:10]:
            mix_copy = dict(mix)
            mix_copy.pop("_id", None)
            # Format time ago
            created = mix.get("created_at")
            if created:
                seconds_ago = (now - created).total_seconds()
                if seconds_ago < 60:
                    time_ago = "Just now"
                elif seconds_ago < 3600:
                    time_ago = f"{int(seconds_ago / 60)}m ago"
                elif seconds_ago < 86400:
                    time_ago = f"{int(seconds_ago / 3600)}h ago"
                else:
                    time_ago = f"{int(seconds_ago / 86400)}d ago"
                mix_copy["time_ago"] = time_ago
            recent_mixes.append(mix_copy)
        
        return {
            "has_subscription": True,
            "subscription": {
                "id": subscription.get("id"),
                "status": subscription.get("status"),
                "window_start": start_hour,
                "window_end": end_hour,
                "window_hours": window_hours,
                "currently_in_window": in_window,
                "days_remaining": days_remaining,
                "expiring_soon": days_remaining <= 5,
                "progress_percent": round(progress_percent, 1),
                "expires_at": sub_end.isoformat() if sub_end else None
            },
            "lifetime_stats": {
                "total_mixes": len(all_history),
                "total_points_earned": total_points,
                "total_xp_earned": total_xp,
                "best_rarity": best_rarity,
                "avg_points_per_mix": round(total_points / len(all_history), 1) if all_history else 0
            },
            "activity_24h": {
                "mixes": len(last_24h),
                "points": sum(m.get("points_earned", 0) for m in last_24h),
                "xp": sum(m.get("xp_earned", 0) for m in last_24h)
            },
            "activity_7d": {
                "mixes": len(last_7d),
                "points": sum(m.get("points_earned", 0) for m in last_7d),
                "xp": sum(m.get("xp_earned", 0) for m in last_7d)
            },
            "rarity_breakdown": rarity_counts,
            "top_ingredients": sorted(ingredient_usage.items(), key=lambda x: x[1], reverse=True)[:5],
            "daily_breakdown": daily_stats,
            "recent_mixes": recent_mixes
        }
        
    except Exception as e:
        logger.error(f"Error fetching detailed stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))




@api_router.post("/auto-mixer/trigger-now")
async def trigger_auto_mixer_now():
    """
    Manually trigger the auto-mixer to run immediately (for testing).
    RESPECTS GAME TREAT LIMITS (4 per 6h window + streak bonuses)
    """
    try:
        now = datetime.now(timezone.utc)
        current_hour = now.hour
        results = []
        
        logger.info(f"🤖 Manual trigger at {now.strftime('%H:%M:%S')} UTC (hour: {current_hour})")
        
        # Find active subscriptions — manual date filtering for string/datetime compatibility
        all_active_subs = await db.auto_mixer_subscriptions.find({
            "status": "active"
        }).to_list(1000)
        
        active_subs = []
        expired_ids = []
        
        for sub in all_active_subs:
            sub_end = sub.get("subscription_end")
            if sub_end:
                try:
                    sub_end = parse_utc_datetime(sub_end)
                except Exception:
                    continue
                if sub_end <= now:
                    expired_ids.append(sub["id"])
                    continue
                active_subs.append(sub)
            else:
                active_subs.append(sub)
        
        # Expire any detected expired subscriptions
        if expired_ids:
            await db.auto_mixer_subscriptions.update_many(
                {"id": {"$in": expired_ids}},
                {"$set": {"status": "expired", "updated_at": now}}
            )
        
        logger.info(f"🤖 Found {len(active_subs)} active subscriptions ({len(expired_ids)} expired)")
        
        for sub in active_subs:
            try:
                start_hour = sub.get("window_start_hour", 0)
                end_hour = sub.get("window_end_hour", 6)
                player_address = sub.get("player_address", "Unknown")
                
                # Check if current hour is within the window
                in_window = False
                if start_hour < end_hour:
                    in_window = start_hour <= current_hour < end_hour
                else:  # Window crosses midnight
                    in_window = current_hour >= start_hour or current_hour < end_hour
                
                if not in_window:
                    results.append({
                        "player": player_address[:20] + "...",
                        "status": "skipped",
                        "reason": f"Outside window ({start_hour}:00-{end_hour}:00, current: {current_hour}:00)"
                    })
                    continue
                
                # CHECK GAME TREAT LIMITS
                treat_status = await anti_cheat_system.get_daily_treat_status(player_address)
                can_create = treat_status.get("can_create_treat", False)
                remaining = treat_status.get("remaining_treats", 0)
                window_limit = treat_status.get("window_limit", 4)
                treats_in_window = treat_status.get("treats_in_window", 0)
                streak_bonus = treat_status.get("streak_bonus", {})
                
                if not can_create or remaining <= 0:
                    results.append({
                        "player": player_address[:20] + "...",
                        "status": "skipped",
                        "reason": f"At treat limit ({treats_in_window}/{window_limit} in window, {remaining} remaining)"
                    })
                    continue
                
                # Get player
                player = await db.players.find_one({"address": player_address})
                
                if not player:
                    results.append({
                        "player": player_address[:20] + "...",
                        "status": "error",
                        "reason": "Player not found in database"
                    })
                    continue
                
                player_level = player.get("level", 1)
                character_bonuses = player.get("character_bonuses", {})
                rare_chance_bonus = character_bonuses.get("rare_chance_bonus", 0.0)
                
                # Get available ingredients for player level
                available_ingredients = ingredient_system.get_unlocked_ingredients(player_level)
                
                if len(available_ingredients) < 2:
                    results.append({
                        "player": player_address[:20] + "...",
                        "status": "error",
                        "reason": f"Not enough ingredients (level {player_level})"
                    })
                    continue
                
                # Select random ingredients (2-4) with full shuffle for variety
                all_ingredient_ids = [ing.id for ing in available_ingredients]
                random.shuffle(all_ingredient_ids)
                num_ingredients = random.randint(2, min(4, len(all_ingredient_ids)))
                selected_ingredients = all_ingredient_ids[:num_ingredients]
                
                # Create the treat using the game engine with character bonuses
                treat_result = game_engine.calculate_treat_outcome(
                    ingredients=selected_ingredients,
                    player_level=player_level,
                    player_address=player_address,
                    rare_chance_bonus=rare_chance_bonus
                )
                
                rarity = treat_result.get("rarity", "Common")
                points = treat_result.get("points_reward", 10)
                xp = treat_result.get("xp_reward", 5)
                
                # Name treat based on rarity and ingredients
                treat_name = f"{rarity} Auto-Treat"
                
                # Save the treat
                treat_id = str(uuid.uuid4())
                treat_doc = {
                    "id": treat_id,
                    "name": treat_name,
                    "creator_address": player_address,
                    "ingredients": selected_ingredients,
                    "rarity": rarity,
                    "rarity_emoji": treat_result.get("rarity_emoji", ""),
                    "rarity_color": treat_result.get("rarity_color", ""),
                    "flavor": treat_result.get("flavor", "Savory"),
                    "created_at": now,
                    "ready_at": now,
                    "image": treat_result.get("image", ""),
                    "brewing_status": "ready",
                    "points_reward": points,
                    "xp_reward": xp,
                    "auto_mixed": True,
                    "collected": False
                }
                
                await db.treats.insert_one(treat_doc)
                
                # Record the auto-mix in history
                await db.auto_mix_history.insert_one({
                    "id": str(uuid.uuid4()),
                    "subscription_id": sub["id"],
                    "player_address": player_address,
                    "treat_id": treat_id,
                    "treat_name": treat_name,
                    "treat_rarity": rarity,
                    "points_earned": points,
                    "xp_earned": xp,
                    "ingredients": selected_ingredients,
                    "created_at": now
                })
                
                # Update subscription stats
                await db.auto_mixer_subscriptions.update_one(
                    {"id": sub["id"]},
                    {"$set": {"last_auto_mix": now}, "$inc": {"total_auto_mixes": 1}}
                )
                
                # Update player streak
                try:
                    await anti_cheat_system.update_player_streak(player_address)
                except:
                    pass
                
                results.append({
                    "player": player_address[:20] + "...",
                    "status": "success",
                    "treat_name": treat_name,
                    "rarity": rarity,
                    "points": points,
                    "xp": xp,
                    "ingredients": selected_ingredients,
                    "treats_in_window": treats_in_window + 1,
                    "window_limit": window_limit
                })
                
                logger.info(f"Manual trigger mix: '{treat_name}' ({rarity}, {points}pts) for {player_address[:20]}...")
                
            except Exception as e:
                results.append({
                    "player": sub.get("player_address", "unknown")[:20] + "...",
                    "status": "error",
                    "reason": str(e)
                })
                logger.error(f"🤖 ❌ Error: {str(e)}")
        
        return {
            "triggered_at": now.isoformat(),
            "current_hour": current_hour,
            "total_active_subs": len(active_subs),
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Error in manual trigger: {e}")
        raise HTTPException(status_code=500, detail=str(e))




# Auto-mixer background task
async def auto_mixer_processor_loop():
    """
    Background loop that processes auto-mixes for active subscribers.
    
    RESPECTS GAME RULES:
    - 4 treats per 6-hour window (base) + streak bonuses
    - Max 16 treats per 24 hours
    - Uses the same treat creation limits as manual play
    - Automatically expires subscriptions past their end date
    """
    logger.info("🤖 Auto-mixer processor started (respects game treat limits)")
    
    while True:
        try:
            now = datetime.now(timezone.utc)
            current_hour = now.hour
            
            logger.info(f"🤖 Auto-mixer checking at {now.strftime('%H:%M:%S')} UTC (hour: {current_hour})")
            
            # Step 1: Fetch ALL subscriptions with status "active" and filter manually
            # (subscription_end may be stored as string or datetime, so MongoDB $gt is unreliable)
            all_active_subs = await db.auto_mixer_subscriptions.find({
                "status": "active"
            }).to_list(1000)
            
            active_subs = []
            expired_ids = []
            
            for sub in all_active_subs:
                sub_end = sub.get("subscription_end")
                if sub_end:
                    try:
                        sub_end = parse_utc_datetime(sub_end)
                    except Exception:
                        logger.warning(f"🤖 Could not parse subscription_end for {sub.get('player_address', '?')}: {sub_end}")
                        continue
                    if sub_end <= now:
                        # Subscription has expired — mark for update
                        expired_ids.append(sub["id"])
                        logger.info(f"🤖 Subscription expired for {sub.get('player_address', '?')[:15]}... (ended {sub_end.isoformat()})")
                        continue
                    active_subs.append(sub)
                else:
                    active_subs.append(sub)
            
            # Step 2: Bulk-expire all detected expired subscriptions
            if expired_ids:
                result = await db.auto_mixer_subscriptions.update_many(
                    {"id": {"$in": expired_ids}},
                    {"$set": {"status": "expired", "updated_at": now}}
                )
                logger.info(f"🤖 Expired {result.modified_count} subscription(s)")
            
            logger.info(f"🤖 Found {len(active_subs)} truly active subscriptions ({len(expired_ids)} just expired)")
            
            for sub in active_subs:
                try:
                    start_hour = sub.get("window_start_hour", 0)
                    end_hour = sub.get("window_end_hour", 6)
                    player_address = sub.get("player_address", "Unknown")
                    
                    # Check if current hour is within the subscription window
                    in_window = False
                    if start_hour < end_hour:
                        in_window = start_hour <= current_hour < end_hour
                    else:  # Window crosses midnight
                        in_window = current_hour >= start_hour or current_hour < end_hour
                    
                    if not in_window:
                        logger.info(f"🤖 {player_address[:15]}... outside subscription window ({start_hour}:00-{end_hour}:00)")
                        continue
                    
                    # CHECK GAME TREAT LIMITS using anti_cheat_system
                    treat_status = await anti_cheat_system.get_daily_treat_status(player_address)
                    
                    can_create = treat_status.get("can_create_treat", False)
                    remaining = treat_status.get("remaining_treats", 0)
                    window_limit = treat_status.get("window_limit", 4)
                    treats_in_window = treat_status.get("treats_in_window", 0)
                    streak_bonus = treat_status.get("streak_bonus", {})
                    
                    logger.info(f"🤖 {player_address[:15]}... treats: {treats_in_window}/{window_limit}, remaining: {remaining}, can_create: {can_create}")
                    
                    if not can_create or remaining <= 0:
                        logger.info(f"🤖 {player_address[:15]}... at treat limit, skipping")
                        continue
                    
                    # Get player info
                    player = await db.players.find_one({"address": player_address})
                    if not player:
                        logger.warning(f"Auto-mixer: Player not found: {player_address}")
                        continue
                    
                    player_level = player.get("level", 1)
                    
                    # Check player's character bonus (Rex gives rare chance boost)
                    character_bonuses = player.get("character_bonuses", {})
                    rare_chance_bonus = character_bonuses.get("rare_chance_bonus", 0.0)
                    
                    # Get available ingredients for player level
                    available_ingredients = ingredient_system.get_unlocked_ingredients(player_level)
                    
                    if len(available_ingredients) < 2:
                        logger.warning(f"Auto-mixer: {player_address[:15]}... not enough ingredients (level {player_level})")
                        continue
                    
                    # Select random ingredients (2-4) with variety
                    # Shuffle the full list for maximum randomness each cycle
                    all_ingredient_ids = [ing.id for ing in available_ingredients]
                    random.shuffle(all_ingredient_ids)
                    num_ingredients = random.randint(2, min(4, len(all_ingredient_ids)))
                    selected_ingredients = all_ingredient_ids[:num_ingredients]
                    
                    # Create the treat using the game engine with character bonuses
                    treat_result = game_engine.calculate_treat_outcome(
                        ingredients=selected_ingredients,
                        player_level=player_level,
                        player_address=player_address,
                        rare_chance_bonus=rare_chance_bonus
                    )
                    
                    rarity = treat_result.get("rarity", "Common")
                    base_points = treat_result.get("points_reward", 10)
                    base_xp = treat_result.get("xp_reward", 5)
                    
                    # Apply streak XP multiplier
                    xp_multiplier = streak_bonus.get("xp_multiplier", 1.0)
                    xp = int(base_xp * xp_multiplier)
                    points = base_points
                    
                    # Name treat based on rarity and ingredients
                    treat_name = f"{rarity} Auto-Treat"
                    
                    # Save the treat (ready to collect)
                    treat_id = str(uuid.uuid4())
                    treat_doc = {
                        "id": treat_id,
                        "name": treat_name,
                        "creator_address": player_address,
                        "ingredients": selected_ingredients,
                        "rarity": rarity,
                        "rarity_emoji": treat_result.get("rarity_emoji", ""),
                        "rarity_color": treat_result.get("rarity_color", ""),
                        "flavor": treat_result.get("flavor", "Savory"),
                        "created_at": now,
                        "ready_at": now,
                        "image": treat_result.get("image", ""),
                        "brewing_status": "ready",
                        "points_reward": points,
                        "xp_reward": xp,
                        "auto_mixed": True,
                        "collected": False
                    }
                    
                    await db.treats.insert_one(treat_doc)
                    
                    # Record in auto-mix history
                    await db.auto_mix_history.insert_one({
                        "id": str(uuid.uuid4()),
                        "subscription_id": sub["id"],
                        "player_address": player_address,
                        "treat_id": treat_id,
                        "treat_name": treat_name,
                        "treat_rarity": rarity,
                        "points_earned": points,
                        "xp_earned": xp,
                        "ingredients": selected_ingredients,
                        "created_at": now
                    })
                    
                    # Update subscription stats
                    await db.auto_mixer_subscriptions.update_one(
                        {"id": sub["id"]},
                        {"$set": {"last_auto_mix": now}, "$inc": {"total_auto_mixes": 1}}
                    )
                    
                    # Update player streak (same as manual play)
                    try:
                        await anti_cheat_system.update_player_streak(player_address)
                    except:
                        pass
                    
                    logger.info(f"🤖 ✅ Created '{treat_name}' for {player_address[:15]}... ({treats_in_window + 1}/{window_limit} in window)")
                    
                except Exception as e:
                    logger.error(f"🤖 ❌ Error for {sub.get('player_address', 'unknown')[:15]}...: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    continue
                    
        except Exception as e:
            logger.error(f"🤖 ❌ Error in auto-mixer loop: {str(e)}")
            import traceback
            traceback.print_exc()
        
        # Check every 30 minutes (respects game limits, so no need to check frequently)
        logger.info("🤖 Auto-mixer sleeping for 30 minutes...")
        await asyncio.sleep(1800)


# =====================================================
# SPIN THE WHEEL SYSTEM
# =====================================================


SPIN_WHEEL_PRIZES = [
    {"id": "points_100", "label": "100 Points", "type": "points", "value": 100, "weight": 25, "color": "#3b82f6", "emoji": "star"},
    {"id": "points_150", "label": "150 Points", "type": "points", "value": 150, "weight": 20, "color": "#8b5cf6", "emoji": "sparkles"},
    {"id": "points_200", "label": "200 Points", "type": "points", "value": 200, "weight": 15, "color": "#06b6d4", "emoji": "gem"},
    {"id": "points_300", "label": "300 Points", "type": "points", "value": 300, "weight": 10, "color": "#fbbf24", "emoji": "trophy"},
    {"id": "points_500", "label": "500 Points", "type": "points", "value": 500, "weight": 5, "color": "#ef4444", "emoji": "fire"},
    {"id": "extra_lives_2", "label": "2 Extra Lives", "type": "extra_lives", "value": 2, "weight": 12, "color": "#10b981", "emoji": "heart"},
    {"id": "extra_lives_4", "label": "4 Extra Lives", "type": "extra_lives", "value": 4, "weight": 5, "color": "#ec4899", "emoji": "hearts"},
    {"id": "mythic_ingredient", "label": "Mythic Ingredient", "type": "mythic_ingredient", "value": 24, "weight": 3, "color": "#14b8a6", "emoji": "crown"},
    {"id": "double_next", "label": "2x Next Treat", "type": "double_next", "value": 2, "weight": 5, "color": "#a855f7", "emoji": "zap"},
]


SPIN_COOLDOWN_HOURS = 24




@api_router.get("/spin-wheel/status/{player_address}")
async def get_spin_wheel_status(player_address: str):
    """Check if player can spin and get wheel configuration"""
    now = datetime.now(timezone.utc)


    last_spin = await db.spin_wheel_history.find_one(
        {"player_address": player_address},
        sort=[("spun_at", -1)]
    )


    can_spin = True
    next_spin_at = None
    hours_remaining = 0


    if last_spin:
        spun_at = parse_utc_datetime(last_spin.get("spun_at", now))
        next_available = spun_at + timedelta(hours=SPIN_COOLDOWN_HOURS)
        if now < next_available:
            can_spin = False
            next_spin_at = next_available.isoformat()
            hours_remaining = max(0, (next_available - now).total_seconds() / 3600)


    total_spins = await db.spin_wheel_history.count_documents({"player_address": player_address})


    prizes = [{"id": p["id"], "label": p["label"], "color": p["color"], "emoji": p["emoji"]} for p in SPIN_WHEEL_PRIZES]


    return {
        "can_spin": can_spin,
        "next_spin_at": next_spin_at,
        "hours_remaining": round(hours_remaining, 1),
        "total_spins": total_spins,
        "prizes": prizes,
        "cooldown_hours": SPIN_COOLDOWN_HOURS
    }




@api_router.post("/spin-wheel/spin")
async def spin_the_wheel(data: dict):
    """Execute a spin — 1 free spin per 24 hours"""
    player_address = data.get("player_address")
    if not player_address:
        raise HTTPException(status_code=400, detail="Player address required")


    now = datetime.now(timezone.utc)


    # Check cooldown
    last_spin = await db.spin_wheel_history.find_one(
        {"player_address": player_address},
        sort=[("spun_at", -1)]
    )


    if last_spin:
        spun_at = parse_utc_datetime(last_spin.get("spun_at", now))
        next_available = spun_at + timedelta(hours=SPIN_COOLDOWN_HOURS)
        if now < next_available:
            hours_left = (next_available - now).total_seconds() / 3600
            raise HTTPException(status_code=429, detail={
                "message": f"Next free spin in {hours_left:.1f} hours",
                "next_spin_at": next_available.isoformat(),
                "hours_remaining": round(hours_left, 1)
            })


    # Weighted random selection
    total_weight = sum(p["weight"] for p in SPIN_WHEEL_PRIZES)
    roll = random.uniform(0, total_weight)
    cumulative = 0
    selected_prize = SPIN_WHEEL_PRIZES[0]
    prize_index = 0


    for i, prize in enumerate(SPIN_WHEEL_PRIZES):
        cumulative += prize["weight"]
        if roll <= cumulative:
            selected_prize = prize
            prize_index = i
            break


    segment_angle = 360 / len(SPIN_WHEEL_PRIZES)
    target_segment_center = (prize_index * segment_angle) + (segment_angle / 2)
    pointer_angle = 270
    landing_angle_degrees = (pointer_angle - target_segment_center) % 360
    full_spins = random.randint(6, 8)
    spin_rotation_degrees = (full_spins * 360) + landing_angle_degrees


    # Apply the prize
    reward_applied = False
    reward_details = {}


    player = await find_player_by_address(player_address)


    if selected_prize["type"] == "points":
        if player:
            await db.players.update_one(
                {"address": player.get("address", player_address)},
                {"$inc": {"points": selected_prize["value"], "total_points_collected": selected_prize["value"]}}
            )
        reward_applied = True
        reward_details = {"points_awarded": selected_prize["value"]}


    elif selected_prize["type"] == "extra_lives":
        if player:
            await db.players.update_one(
                {"address": player.get("address", player_address)},
                {"$inc": {"extra_treats_balance": selected_prize["value"]}}
            )
        reward_applied = True
        reward_details = {"extra_lives_awarded": selected_prize["value"]}


    elif selected_prize["type"] == "mythic_ingredient":
        expires_at = now + timedelta(hours=24)
        await db.spin_wheel_buffs.update_one(
            {"player_address": player_address, "buff_type": "mythic_ingredient"},
            {"$set": {
                "player_address": player_address,
                "buff_type": "mythic_ingredient",
                "expires_at": expires_at,
                "granted_at": now,
                "active": True
            }},
            upsert=True
        )
        reward_applied = True
        reward_details = {"mythic_ingredient_hours": 24, "expires_at": expires_at.isoformat()}


    elif selected_prize["type"] == "double_next":
        await db.spin_wheel_buffs.update_one(
            {"player_address": player_address, "buff_type": "double_next_treat"},
            {"$set": {
                "player_address": player_address,
                "buff_type": "double_next_treat",
                "multiplier": 2,
                "uses_remaining": 1,
                "granted_at": now,
                "active": True
            }},
            upsert=True
        )
        reward_applied = True
        reward_details = {"multiplier": 2, "uses": 1}


    # Record in history
    await db.spin_wheel_history.insert_one({
        "id": str(uuid.uuid4()),
        "player_address": player_address,
        "prize_id": selected_prize["id"],
        "prize_label": selected_prize["label"],
        "prize_type": selected_prize["type"],
        "prize_value": selected_prize["value"],
        "spun_at": now,
        "reward_applied": reward_applied
    })

    # Write to global activity feed
    try:
        _spin_player = await db.players.find_one({"address": player_address}, {"_id": 0, "nickname": 1})
        _spin_nickname = (_spin_player or {}).get("nickname") or "Anonymous"
        await db.activity_feed.insert_one({
            "id": str(uuid.uuid4()),
            "activity_type": "spin",
            "type": "spin",
            "player_address": player_address,
            "player_nickname": _spin_nickname,
            "treat_name": f"🎰 {selected_prize['label']}",
            "prize_label": selected_prize["label"],
            "prize_type": selected_prize["type"],
            "prize_value": selected_prize["value"],
            "rarity": None,
            "emoji": selected_prize.get("emoji", "star"),
            "points_reward": selected_prize["value"] if selected_prize["type"] == "points" else 0,
            "xp_reward": 0,
            "created_at": now.isoformat(),
        })
    except Exception as _feed_err:
        logger.warning(f"Activity feed write failed (spin): {_feed_err}")


    # Calculate next spin time
    next_spin_at = now + timedelta(hours=SPIN_COOLDOWN_HOURS)


    return {
        "prize": {
            "id": selected_prize["id"],
            "label": selected_prize["label"],
            "type": selected_prize["type"],
            "value": selected_prize["value"],
            "color": selected_prize["color"],
            "emoji": selected_prize["emoji"]
        },
        "prize_index": prize_index,
        "landing_angle_degrees": round(landing_angle_degrees, 6),
        "full_spins": full_spins,
        "spin_rotation_degrees": round(spin_rotation_degrees, 6),
        "reward_applied": reward_applied,
        "reward_details": reward_details,
        "next_spin_at": next_spin_at.isoformat(),
        "message": f"You won {selected_prize['label']}!"
    }




# ============================================================================
# LAB ARENA — Phase 1: leaderboard, entry, chat, predictions, heat events
# ============================================================================
from services import arena_system  # noqa: E402


@api_router.get("/arena/current")
async def arena_current():
    arena = await arena_system.get_or_create_current_arena(db)
    heat = await arena_system.get_or_rotate_heat_event(db)
    leaderboard = await arena_system.get_leaderboard(db, limit=20)
    return {
        "arena": arena,
        "heat": heat,
        "top": leaderboard["top"],
        "entries_preview": leaderboard["entries"][:5],
    }


@api_router.get("/arena/leaderboard")
async def arena_leaderboard(limit: int = 50):
    return await arena_system.get_leaderboard(db, limit=min(limit, 100))


async def _canonical_address(addr: str) -> str:
    """Resolve any caller-supplied address (e.g. lowercase `tg_<id>`,
    uppercase `TG_<id>`, or a wallet) to the address actually stored on the
    canonical player document. Falls back to the input unchanged when no
    player is found, so non-TG callers are unaffected.

    This protects every endpoint that does direct `find_one({"address":...})`
    or MongoDB `$lookup` joins against case-sensitivity drift between
    historical/migrated docs and freshly-deployed frontend payloads.
    """
    if not addr:
        return addr
    player = await find_player_by_address(addr)
    if player and player.get("address"):
        return player["address"]
    return addr


@api_router.post("/arena/join")
async def arena_join(payload: dict):
    addr = (payload or {}).get("address")
    nickname = (payload or {}).get("nickname")
    if not addr:
        raise HTTPException(status_code=400, detail="address required")
    addr = await _canonical_address(addr)  # tg_<id> → TG_<id>
    try:
        result = await arena_system.join_arena(db, addr, nickname)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


@api_router.get("/arena/chat")
async def arena_chat_list(limit: int = 40):
    msgs = await arena_system.get_chat(db, limit=min(limit, 100))
    return {"messages": msgs}


@api_router.post("/arena/chat")
async def arena_chat_post(payload: dict):
    addr = (payload or {}).get("address")
    nickname = (payload or {}).get("nickname") or ""
    text = (payload or {}).get("text") or ""
    if not addr:
        raise HTTPException(status_code=400, detail="address required")
    addr = await _canonical_address(addr)
    try:
        msg = await arena_system.post_chat(db, addr, nickname, text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": msg}


@api_router.get("/arena/heat")
async def arena_heat():
    return await arena_system.get_or_rotate_heat_event(db)


@api_router.post("/arena/predict")
async def arena_predict(payload: dict):
    addr = (payload or {}).get("address")
    target = (payload or {}).get("target_address")
    if not addr or not target:
        raise HTTPException(status_code=400, detail="address and target_address required")
    addr = await _canonical_address(addr)
    target = await _canonical_address(target)
    try:
        pred = await arena_system.place_prediction(db, addr, target)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"prediction": pred}


@api_router.get("/arena/prediction/{address}")
async def arena_user_prediction(address: str):
    address = await _canonical_address(address)
    pred = await arena_system.get_user_prediction(db, address)
    return {"prediction": pred}

# ============================================================
# 🐕  SHIBA PET ROUTES  (Lab page — pet feeding feature)
# ============================================================
# These endpoints back the ShibaGrowth.jsx component on the Lab page.
# Stored in the `player_pets` collection, keyed by `owner` = player_address.
#
# IMPORTANT: The two specific sub-routes (/shiba/create/{addr} and
# /shiba/feed/{addr}) MUST be declared BEFORE the generic
# /shiba/{player_address} GET, otherwise FastAPI would happily route
# /shiba/create/<addr> into get_shiba() with player_address="create"
# and return the wrong response.
# ------------------------------------------------------------

# XP awarded per treat rarity when fed to the pet
SHIBA_RARITY_XP = {
    "Starter":   8,
    "Common":    8,
    "Uncommon":  18,
    "Rare":      35,
    "Epic":      65,
    "Legendary": 110,
    "Mythic":    200,
}

# Stage thresholds — must match STAGES[] in frontend/src/components/ShibaGrowth.jsx
SHIBA_STAGE_XP = [0, 150, 400, 800, 1500, 2800]


def _shiba_stage(xp: int) -> int:
    """Return the highest stage (0–5) the pet qualifies for at `xp` total XP."""
    stage = 0
    for i, threshold in enumerate(SHIBA_STAGE_XP):
        if xp >= threshold:
            stage = i
    return stage


@api_router.post("/shiba/create/{player_address}")
async def create_shiba(player_address: str):
    """Get existing pet or create a new one — idempotent.
    Owner lookup is case-insensitive (wallet addresses can arrive checksummed
    or lowercased depending on the flow), but new pets are always stored with
    a lowercased owner so future writes are consistent."""
    existing = await db.player_pets.find_one(
        {"owner": {"$regex": f"^{re.escape(player_address)}$", "$options": "i"}},
        {"_id": 0}
    )
    if existing:
        return existing
    pet = {
        "pet_id": str(uuid.uuid4()),
        "owner": player_address.lower(),
        "current_stage": 0,
        "current_xp": 0,
        "total_treats_fed": 0,
        "favorite_ingredient": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_fed_at": None,
    }
    await db.player_pets.insert_one(pet)
    pet.pop("_id", None)
    return pet


@api_router.post("/shiba/feed/{player_address}")
async def feed_shiba(player_address: str, body: dict):
    """Record a feeding, update XP and stage. Auto-creates pet if missing.
    Owner lookups are case-insensitive; the stored owner key (existing or
    newly created) is reused for all subsequent writes in this call so the
    XP update always lands on the exact same document just read."""
    treat_rarity = body.get("treat_rarity", "Common")
    xp_gained    = int(body.get("xp_gained", SHIBA_RARITY_XP.get(treat_rarity, 8)))

    owner_filter = {"owner": {"$regex": f"^{re.escape(player_address)}$", "$options": "i"}}
    pet = await db.player_pets.find_one(owner_filter)
    if not pet:
        # Auto-create rather than error — first feed creates the pet
        pet = {
            "pet_id": str(uuid.uuid4()),
            "owner": player_address.lower(),
            "current_stage": 0,
            "current_xp": 0,
            "total_treats_fed": 0,
            "favorite_ingredient": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_fed_at": None,
        }
        await db.player_pets.insert_one(pet)
        owner_filter = {"owner": pet["owner"]}  # exact match now that we just created it

    new_xp    = (pet.get("current_xp") or 0) + xp_gained
    new_stage = _shiba_stage(new_xp)
    now       = datetime.now(timezone.utc).isoformat()

    await db.player_pets.update_one(
        owner_filter,
        {
            "$set": {
                "current_xp":    new_xp,
                "current_stage": new_stage,
                "last_fed_at":   now,
            },
            "$inc": {"total_treats_fed": 1},
        },
    )

    updated = await db.player_pets.find_one(owner_filter, {"_id": 0})
    evolved  = new_stage > (pet.get("current_stage") or 0)

    # ── Check for XP milestone crates ──────────────────────────────────────
    # Use the pet's actual stored owner (not the raw request param) so the
    # crate's owner field always matches exactly what's in player_pets —
    # this is what makes the later case-insensitive crate-open lookup
    # reliable rather than relying on it as the only safety net.
    old_xp = (pet.get("current_xp") or 0)
    crate_owner = pet.get("owner") or player_address.lower()
    earned_crates = _check_milestone_crates(old_xp, new_xp, crate_owner)
    if earned_crates:
        await db.lab_crates.insert_many(earned_crates)
        logger.info(f"🎁 {len(earned_crates)} Lab Crate(s) earned by {crate_owner}")

    return {
        "pet":          updated,
        "xp_gained":    xp_gained,
        "evolved":      evolved,
        "new_stage":    new_stage,
        "crates_earned": [{"id": c["id"], "crate_type": c["crate_type"], "milestone_label": c["milestone_label"]} for c in earned_crates],
    }


@api_router.post("/shiba/crate/{crate_id}/open")
async def open_lab_crate(crate_id: str, body: dict):
    """Open a pending Lab Crate and generate rewards."""
    player_address = body.get("player_address")
    if not player_address:
        raise HTTPException(status_code=400, detail="player_address required")

    # Case-insensitive owner match — wallet addresses can arrive checksummed
    # (mixed case from wagmi) or lowercased depending on which flow stored them.
    crate = await db.lab_crates.find_one({
        "id": crate_id,
        "owner": {"$regex": f"^{re.escape(player_address)}$", "$options": "i"},
        "status": "pending",
    })
    if not crate:
        raise HTTPException(status_code=404, detail="Crate not found or already opened")

    # Generate 3 rewards
    rewards = []
    for _ in range(3):
        r = _pick_crate_reward(crate["crate_type"])
        reward = dict(r)
        reward.pop("weight", None)
        if not reward.get("label"):
            reward["label"] = reward.get("value", "Reward")
        # Enrich ingredient rewards with real name + emoji from ingredient system
        if reward.get("type") == "ingredient":
            ing = ingredient_system.get_ingredient(reward["value"])
            if ing:
                reward["label"]     = ing.name
                reward["icon"]      = ing.emoji
                reward["ing_name"]  = ing.name
                reward["ing_rarity"]= ing.category.value
        rewards.append(reward)

    # Apply rewards to player
    points_total = sum(r["value"] for r in rewards if r["type"] == "points")
    lives_total  = sum(r["value"] for r in rewards if r["type"] == "lives")
    cosmetics    = [r["value"] for r in rewards if r["type"] == "cosmetic"]
    ingredient_ids = [r["value"] for r in rewards if r["type"] == "ingredient"]

    now_dt = datetime.now(timezone.utc)
    now = now_dt.isoformat()

    # Resolve the real player document once (handles TG_/tg_ case +
    # telegram_id fallback) and reuse it for every grant below, instead of
    # filtering separately by raw address per reward type — that pattern
    # previously created duplicate orphan player documents for Telegram
    # players (same root cause fixed elsewhere in this file).
    player = await find_player_by_address(player_address)
    player_filter = None
    if player:
        player_filter = {"id": player["id"]}
    elif player_address and not player_address.startswith("guest_") and player_address != "GUEST_USER":
        # No player document exists at all yet — create a minimal one now
        # rather than letting every grant below silently no-op (the same
        # defensive-creation pattern used in create_treat/collect_treat).
        short_addr = player_address[:6] + player_address[-4:] if len(player_address) > 10 else player_address
        new_player_doc = {
            "id": str(uuid.uuid4()),
            "address": player_address,
            "nickname": f"Scientist {short_addr}",
            "created_treats": [],
            "last_active": now,
        }
        await db.players.insert_one(new_player_doc)
        player_filter = {"id": new_player_doc["id"]}

    # Grant points
    if points_total > 0 and player_filter:
        await db.players.update_one(player_filter, {"$inc": {"points": points_total}})

    # Grant extra lives
    if lives_total > 0 and player_filter:
        await db.players.update_one(player_filter, {"$inc": {"extra_treats_balance": lives_total}})

    # Grant cosmetics — use the resolved owner key so this never creates a
    # second, differently-cased wardrobe document for the same player.
    if cosmetics:
        wardrobe_owner = await _wardrobe_owner_filter(player_address)
        await db.player_wardrobes.update_one(
            wardrobe_owner,
            {"$addToSet": {"owned": {"$each": cosmetics}}},
            upsert=True
        )

    # Grant ingredients — temporarily unlocked for 48 hours regardless of
    # the player's level, then they expire. This is the actual fix for
    # "ingredients won never appear on the player's ingredient list": the
    # IDs now come from the real Season 2 catalog (services/ingredient_system.py)
    # instead of fictional names, AND they're actually written somewhere
    # the Lab page's ingredient tray can read from (see
    # GET /player/{address}/temp-ingredients below).
    granted_ingredients = []
    if ingredient_ids and player_filter:
        expires_at = (now_dt + timedelta(hours=48)).isoformat()
        grants = []
        for ing_id in ingredient_ids:
            ing = ingredient_system.get_ingredient(ing_id)
            grant = {
                "ingredient_id": ing_id,
                "ingredient_name": ing.name if ing else ing_id,
                "granted_at": now,
                "expires_at": expires_at,
                "source": "lab_crate",
            }
            grants.append(grant)
            granted_ingredients.append(grant)
        await db.players.update_one(
            player_filter,
            {"$push": {"temp_unlocked_ingredients": {"$each": grants}}}
        )

    # Mark crate as opened
    await db.lab_crates.update_one(
        {"id": crate_id},
        {"$set": {"status": "opened", "opened_at": now, "rewards": rewards}}
    )

    return {
        "rewards": rewards,
        "points_granted": points_total,
        "lives_granted": lives_total,
        "ingredients_granted": granted_ingredients,
    }


@api_router.get("/player/{player_address}/temp-ingredients")
async def get_temp_unlocked_ingredients(player_address: str):
    """
    Active (non-expired) Lab-Crate-won ingredients for a player, with the
    real catalog metadata (name, emoji, color, rarity tier) merged in plus
    a `seconds_remaining` countdown so the frontend can show a live timer.
    Expired entries are filtered out here rather than deleted from the
    document, so the grant history stays intact.
    """
    player = await find_player_by_address(player_address)
    if not player:
        return {"ingredients": []}

    now = datetime.now(timezone.utc)
    active = []
    for grant in player.get("temp_unlocked_ingredients", []):
        try:
            expires_at = datetime.fromisoformat(grant["expires_at"])
        except (KeyError, ValueError):
            continue
        if expires_at <= now:
            continue  # expired — omit, don't delete

        ing = ingredient_system.get_ingredient(grant["ingredient_id"])
        active.append({
            "id": grant["ingredient_id"],
            "name": ing.name if ing else grant.get("ingredient_name", grant["ingredient_id"]),
            "emoji": ing.emoji if ing else "❓",
            "color": ing.color if ing else "#94a3b8",
            "category": ing.category.value if ing else "Rare",
            "description": ing.description if ing else "A rare ingredient won from a Lab Crate.",
            "source": grant.get("source", "lab_crate"),
            "granted_at": grant["granted_at"],
            "expires_at": grant["expires_at"],
            "seconds_remaining": max(0, int((expires_at - now).total_seconds())),
        })

    # Soonest-expiring first, so the most urgent one shows up first in any UI.
    active.sort(key=lambda x: x["seconds_remaining"])
    return {"ingredients": active}


@api_router.post("/admin/shiba/backfill-crates")
async def backfill_milestone_crates(admin_key: str = None):
    """
    One-time migration: scans all existing player pets, compares their
    current_xp against XP_MILESTONES, and grants any crates they never
    received because they earned XP before the crate system existed.
    Safe to run multiple times — skips milestones already credited.
    """
    if admin_key != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")

    now = datetime.now(timezone.utc).isoformat()
    pets = await db.player_pets.find({}, {"_id": 0}).to_list(10000)

    total_pets      = len(pets)
    total_granted   = 0
    skipped         = 0
    results         = []

    for pet in pets:
        player_address = pet.get("owner")
        current_xp     = pet.get("current_xp", 0) or 0

        if not player_address or current_xp == 0:
            skipped += 1
            continue

        # Find which milestones this player has already been credited
        # (check existing crates in lab_crates collection)
        existing_crates = await db.lab_crates.find(
            {"owner": player_address},
            {"_id": 0, "milestone_xp": 1}
        ).to_list(100)
        already_credited_xp = {c["milestone_xp"] for c in existing_crates if c.get("milestone_xp")}

        # Determine which milestones they've passed but haven't been credited for
        owed_crates = []
        for m in XP_MILESTONES:
            if current_xp >= m["xp"] and m["xp"] not in already_credited_xp:
                owed_crates.append({
                    "id":               str(uuid.uuid4()),
                    "owner":            player_address,
                    "crate_type":       m["crate"],
                    "milestone_label":  m["label"],
                    "milestone_xp":     m["xp"],
                    "status":           "pending",
                    "earned_at":        now,
                    "backfilled":       True,
                })

        if owed_crates:
            await db.lab_crates.insert_many(owed_crates)
            total_granted += len(owed_crates)
            results.append({
                "player": player_address,
                "xp": current_xp,
                "crates_granted": len(owed_crates),
                "milestones": [c["milestone_label"] for c in owed_crates],
            })
            logger.info(
                f"[Backfill] {player_address} → {len(owed_crates)} crate(s) "
                f"(XP={current_xp}): {[c['milestone_label'] for c in owed_crates]}"
            )

    return {
        "ok":             True,
        "total_pets":     total_pets,
        "pets_updated":   len(results),
        "crates_granted": total_granted,
        "skipped":        skipped,
        "details":        results,
    }


@api_router.get("/shiba/{player_address}")
async def get_shiba(player_address: str):
    """Get pet — returns 404 if none exists yet (frontend will call /shiba/create/:address)."""
    pet = await db.player_pets.find_one(
        {"owner": {"$regex": f"^{re.escape(player_address)}$", "$options": "i"}},
        {"_id": 0}
    )
    if not pet:
        raise HTTPException(status_code=404, detail="No pet found")
    return pet


# ═══════════════════════════════════════════════════════════════════════════════
# LAB CRATE + PET WARDROBE SYSTEM
# ═══════════════════════════════════════════════════════════════════════════════

CRATE_REWARD_TABLES = {
    "basic": [
        {"type": "lives",      "value": 1,   "label": "+1 Extra Life",       "icon": "❤️",  "rarity": "Common",    "weight": 30},
        {"type": "lives",      "value": 2,   "label": "+2 Extra Lives",      "icon": "❤️",  "rarity": "Uncommon",  "weight": 20},
        {"type": "points",     "value": 100, "label": "100 Points",          "icon": "⭐",  "rarity": "Common",    "weight": 25},
        {"type": "points",     "value": 250, "label": "250 Points",          "icon": "⭐",  "rarity": "Uncommon",  "weight": 15},
        # Real Season 2 ingredient (was the fictional "Quantum Bone Dust",
        # which never existed in services/ingredient_system.py and could
        # never show up on the player's ingredient list as a result).
        {"type": "ingredient", "value": "S2_015",  "icon": "💥", "rarity": "Rare",      "weight": 7},
        {"type": "cosmetic",   "value": "cap_basic",          "icon": "🧢", "rarity": "Common",    "weight": 3},
    ],
    "rare": [
        {"type": "lives",      "value": 2,   "label": "+2 Extra Lives",      "icon": "❤️",  "rarity": "Uncommon",  "weight": 20},
        {"type": "lives",      "value": 3,   "label": "+3 Extra Lives",      "icon": "❤️",  "rarity": "Rare",      "weight": 10},
        {"type": "points",     "value": 250, "label": "250 Points",          "icon": "⭐",  "rarity": "Uncommon",  "weight": 20},
        {"type": "points",     "value": 500, "label": "500 Points",          "icon": "💎",  "rarity": "Rare",      "weight": 15},
        # Real ingredients (was fictional "Lunar Syrup" / "Toxic Cheese")
        {"type": "ingredient", "value": "S2_008",  "icon": "🌙", "rarity": "Rare",      "weight": 15},
        {"type": "ingredient", "value": "S2_035",  "icon": "🧀", "rarity": "Epic",      "weight": 8},
        {"type": "cosmetic",   "value": "goggles_lab",        "icon": "🥽", "rarity": "Rare",      "weight": 8},
        {"type": "cosmetic",   "value": "aura_fire",          "icon": "🔥", "rarity": "Rare",      "weight": 4},
    ],
    "elite": [
        {"type": "lives",      "value": 3,   "label": "+3 Extra Lives",      "icon": "❤️",  "rarity": "Rare",      "weight": 15},
        {"type": "points",     "value": 500, "label": "500 Points",          "icon": "💎",  "rarity": "Rare",      "weight": 20},
        {"type": "points",     "value": 1000,"label": "1000 Points",         "icon": "🌟",  "rarity": "Epic",      "weight": 10},
        # Real ingredients (was fictional "Golden Bacon Extract" / "Plasma Kibble")
        {"type": "ingredient", "value": "S2_034",  "icon": "🥓", "rarity": "Epic",      "weight": 20},
        {"type": "ingredient", "value": "S2_046",  "icon": "🪐", "rarity": "Legendary", "weight": 10},
        {"type": "cosmetic",   "value": "crown_gold",         "icon": "👑", "rarity": "Epic",      "weight": 12},
        {"type": "cosmetic",   "value": "aura_electric",      "icon": "⚡", "rarity": "Legendary", "weight": 8},
        {"type": "cosmetic",   "value": "armor_reactor",      "icon": "🛡️","rarity": "Epic",      "weight": 5},
    ],
    "legendary": [
        {"type": "lives",      "value": 5,   "label": "+5 Extra Lives",      "icon": "❤️",  "rarity": "Legendary", "weight": 10},
        {"type": "points",     "value": 1000,"label": "1000 Points",         "icon": "🌟",  "rarity": "Epic",      "weight": 15},
        {"type": "points",     "value": 2500,"label": "2500 Points",         "icon": "💥",  "rarity": "Legendary", "weight": 8},
        # Real ingredient (was fictional "Galaxy Protein")
        {"type": "ingredient", "value": "S2_047",  "icon": "🐉", "rarity": "Legendary", "weight": 20},
        {"type": "cosmetic",   "value": "crown_mythic",       "icon": "💎", "rarity": "Mythic",    "weight": 15},
        {"type": "cosmetic",   "value": "aura_galaxy",        "icon": "🌌", "rarity": "Mythic",    "weight": 15},
        {"type": "cosmetic",   "value": "suit_scientist",     "icon": "🦺", "rarity": "Mythic",    "weight": 12},
        {"type": "cosmetic",   "value": "jetpack_rocket",     "icon": "🚀", "rarity": "Legendary", "weight": 5},
    ],
}

XP_MILESTONES = [
    {"xp": 150,  "stage": 1, "crate": "basic",     "label": "Young Pup"},
    {"xp": 400,  "stage": 2, "crate": "basic",     "label": "Teen Shiba"},
    {"xp": 600,  "stage": 2, "crate": "rare",      "label": "Mid Growth"},
    {"xp": 800,  "stage": 3, "crate": "rare",      "label": "Adult Shiba"},
    {"xp": 1100, "stage": 3, "crate": "elite",     "label": "Evolved"},
    {"xp": 1500, "stage": 4, "crate": "elite",     "label": "Alpha Shiba"},
    {"xp": 2000, "stage": 4, "crate": "legendary", "label": "Champion"},
    {"xp": 2800, "stage": 5, "crate": "legendary", "label": "Mythic Lab"},
]


def _pick_crate_reward(crate_type: str) -> dict:
    import random
    table = CRATE_REWARD_TABLES.get(crate_type, CRATE_REWARD_TABLES["basic"])
    total = sum(r["weight"] for r in table)
    roll = random.uniform(0, total)
    cumulative = 0
    for reward in table:
        cumulative += reward["weight"]
        if roll <= cumulative:
            return reward
    return table[-1]


def _check_milestone_crates(old_xp: int, new_xp: int, player_address: str) -> list:
    """Return list of crates earned for XP milestones crossed between old_xp and new_xp."""
    earned = []
    for m in XP_MILESTONES:
        if old_xp < m["xp"] <= new_xp:
            earned.append({
                "id": str(uuid.uuid4()),
                "owner": player_address,
                "crate_type": m["crate"],
                "milestone_label": m["label"],
                "milestone_xp": m["xp"],
                "status": "pending",
                "earned_at": datetime.now(timezone.utc).isoformat(),
            })
    return earned



@api_router.get("/shiba/crates/{player_address}")
async def get_pending_crates(player_address: str):
    """Get all pending (unopened) Lab Crates for a player."""
    crates = await db.lab_crates.find(
        {"owner": {"$regex": f"^{re.escape(player_address)}$", "$options": "i"}, "status": "pending"},
        {"_id": 0}
    ).sort("earned_at", 1).to_list(50)
    return {"crates": crates, "count": len(crates)}


@api_router.get("/shiba/wardrobe/{player_address}")
async def get_wardrobe(player_address: str):
    """Get player's cosmetic inventory and equipped items."""
    wardrobe = await db.player_wardrobes.find_one(
        {"owner": {"$regex": f"^{re.escape(player_address)}$", "$options": "i"}},
        {"_id": 0}
    )
    if not wardrobe:
        return {"owned": [], "equipped": {}}
    return {"owned": wardrobe.get("owned", []), "equipped": wardrobe.get("equipped", {})}


async def _wardrobe_owner_filter(player_address: str) -> dict:
    """Resolve the exact owner key already in player_wardrobes (case-insensitive
    lookup), falling back to a lowercased key if no document exists yet — so
    upsert writes never create a second, differently-cased duplicate document."""
    existing = await db.player_wardrobes.find_one(
        {"owner": {"$regex": f"^{re.escape(player_address)}$", "$options": "i"}},
        {"owner": 1}
    )
    return {"owner": existing["owner"]} if existing else {"owner": player_address.lower()}


@api_router.post("/shiba/wardrobe/{player_address}/equip")
async def equip_cosmetic(player_address: str, body: dict):
    item_id  = body.get("item_id")
    category = body.get("category")
    if not item_id or not category:
        raise HTTPException(status_code=400, detail="item_id and category required")
    owner_filter = await _wardrobe_owner_filter(player_address)
    await db.player_wardrobes.update_one(
        owner_filter,
        {"$set": {f"equipped.{category}": item_id}},
        upsert=True
    )
    return {"ok": True}


@api_router.post("/shiba/wardrobe/{player_address}/unequip")
async def unequip_cosmetic(player_address: str, body: dict):
    category = body.get("category")
    if not category:
        raise HTTPException(status_code=400, detail="category required")
    owner_filter = await _wardrobe_owner_filter(player_address)
    await db.player_wardrobes.update_one(
        owner_filter,
        {"$unset": {f"equipped.{category}": ""}}
    )
    return {"ok": True}



# ═══════════════════════════════════════════════════════════════════════════════
# /api/lab/* ALIASES — conflict-free paths, cannot be caught by
# GET /shiba/{player_address}. Frontend uses these in MyDoge and all browsers.
# ═══════════════════════════════════════════════════════════════════════════════

@api_router.get("/lab/crates/{player_address}")
async def lab_get_pending_crates(player_address: str):
    # Case-insensitive — same reasoning as lab_open_crate below
    crates = await db.lab_crates.find(
        {"owner": {"$regex": f"^{re.escape(player_address)}$", "$options": "i"}, "status": "pending"},
        {"_id": 0}
    ).sort("earned_at", 1).to_list(50)
    return {"crates": crates, "count": len(crates)}


@api_router.post("/lab/crate/{crate_id}/open")
async def lab_open_crate(crate_id: str, body: dict):
    player_address = body.get("player_address")
    if not player_address:
        raise HTTPException(status_code=400, detail="player_address required")
    # Case-insensitive owner match — wallet addresses can arrive checksummed
    # (mixed case from wagmi) or lowercased depending on which flow stored them.
    crate = await db.lab_crates.find_one({
        "id": crate_id,
        "owner": {"$regex": f"^{re.escape(player_address)}$", "$options": "i"},
        "status": "pending",
    })
    if not crate:
        raise HTTPException(status_code=404, detail="Crate not found or already opened")

    rewards = []
    for _ in range(3):
        r = _pick_crate_reward(crate["crate_type"])
        reward = dict(r)
        reward.pop("weight", None)
        if not reward.get("label"):
            reward["label"] = reward.get("value", "Reward")
        # Enrich ingredient rewards with real name + emoji
        if reward.get("type") == "ingredient":
            ing = ingredient_system.get_ingredient(reward["value"])
            if ing:
                reward["label"]      = ing.name
                reward["icon"]       = ing.emoji
                reward["ing_name"]   = ing.name
                reward["ing_rarity"] = ing.category.value
        rewards.append(reward)

    points_total   = sum(r["value"] for r in rewards if r["type"] == "points")
    lives_total    = sum(r["value"] for r in rewards if r["type"] == "lives")
    cosmetics      = [r["value"] for r in rewards if r["type"] == "cosmetic"]
    ingredient_ids = [r["value"] for r in rewards if r["type"] == "ingredient"]
    now_dt = datetime.now(timezone.utc)
    now    = now_dt.isoformat()

    player        = await find_player_by_address(player_address)
    player_filter = {"id": player["id"]} if player else None

    if points_total > 0 and player_filter:
        await db.players.update_one(player_filter, {"$inc": {"points": points_total}})
    if lives_total > 0 and player_filter:
        await db.players.update_one(player_filter, {"$inc": {"extra_treats_balance": lives_total}})
    if cosmetics:
        wardrobe_owner = await _wardrobe_owner_filter(player_address)
        await db.player_wardrobes.update_one(
            wardrobe_owner,
            {"$addToSet": {"owned": {"$each": cosmetics}}},
            upsert=True
        )

    granted_ingredients = []
    if ingredient_ids and player_filter:
        expires_at = (now_dt + timedelta(hours=48)).isoformat()
        grants = []
        for ing_id in ingredient_ids:
            ing = ingredient_system.get_ingredient(ing_id)
            grant = {
                "ingredient_id":   ing_id,
                "ingredient_name": ing.name if ing else ing_id,
                "granted_at":      now,
                "expires_at":      expires_at,
                "source":          "lab_crate",
            }
            grants.append(grant)
            granted_ingredients.append(grant)
        await db.players.update_one(
            player_filter,
            {"$push": {"temp_unlocked_ingredients": {"$each": grants}}}
        )

    await db.lab_crates.update_one(
        {"id": crate_id},
        {"$set": {"status": "opened", "opened_at": now, "rewards": rewards}}
    )
    return {
        "rewards":             rewards,
        "points_granted":      points_total,
        "lives_granted":       lives_total,
        "ingredients_granted": granted_ingredients,
    }


@api_router.get("/lab/wardrobe/{player_address}")
async def lab_get_wardrobe(player_address: str):
    wardrobe = await db.player_wardrobes.find_one(
        {"owner": {"$regex": f"^{re.escape(player_address)}$", "$options": "i"}},
        {"_id": 0}
    )
    if not wardrobe:
        return {"owned": [], "equipped": {}}
    return {"owned": wardrobe.get("owned", []), "equipped": wardrobe.get("equipped", {})}


@api_router.post("/lab/wardrobe/{player_address}/equip")
async def lab_equip(player_address: str, body: dict):
    item_id  = body.get("item_id")
    category = body.get("category")
    if not item_id or not category:
        raise HTTPException(status_code=400, detail="item_id and category required")
    owner_filter = await _wardrobe_owner_filter(player_address)
    await db.player_wardrobes.update_one(
        owner_filter,
        {"$set": {f"equipped.{category}": item_id}},
        upsert=True
    )
    return {"ok": True}


@api_router.post("/lab/wardrobe/{player_address}/unequip")
async def lab_unequip(player_address: str, body: dict):
    category = body.get("category")
    if not category:
        raise HTTPException(status_code=400, detail="category required")
    owner_filter = await _wardrobe_owner_filter(player_address)
    await db.player_wardrobes.update_one(
        owner_filter,
        {"$unset": {f"equipped.{category}": ""}}
    )
    return {"ok": True}


@app.on_event("startup")
async def startup_event():
    """Start background schedulers on app startup"""
    logger.info("🚀 DogeFood Lab API starting...")
    
    # Create indexes for performance
    try:
        await db.chat_messages.create_index([("created_at", -1)])
        await db.players.create_index(
            "address",
            unique=True,
            partialFilterExpression={"address": {"$type": "string"}}
        )
        await db.players.create_index("telegram_id", sparse=True)
        # Critical: compound index for leaderboard sort
        await db.players.create_index([("points", -1), ("level", -1)])
        await db.players.create_index("last_active")
        await db.treats.create_index("id")
        await db.treats.create_index("creator_address")
        await db.treats.create_index([("created_at", -1)])
        await db.treats.create_index("brewing_status")
        # Compound index for anti-cheat: treats by creator + time range
        await db.treats.create_index([("creator_address", 1), ("created_at", -1)])
        # Compound index for leaderboard/stats: distinct creators of collected treats
        await db.treats.create_index([("brewing_status", 1), ("creator_address", 1)])
        # Compound index for today's activity count
        await db.treats.create_index([("brewing_status", 1), ("collected_at", -1)])
        await db.special_ingredient_holders.create_index([("player_address", 1), ("is_active", 1)])
        logger.info("DB indexes created/verified")
    except Exception as e:
        logger.error(f"Failed to create indexes: {e}")
    
    # Delay background task startup to allow health checks to pass first
    async def delayed_startup():
        # Wait 30 seconds before starting background tasks
        # This ensures Render's health check passes first
        await asyncio.sleep(30)
        
        logger.info("📌 Starting background tasks...")
        
        # Start the Kernel of Wow scheduler loop as a background task
        asyncio.create_task(kernel_scheduler_loop())
        logger.info("🎯 Kernel of Wow background scheduler started")
        
        # Start the notification processor loop
        asyncio.create_task(notification_processor_loop())
        logger.info("🔔 Notification processor started")
        
        # Start the auto-mixer processor loop
        asyncio.create_task(auto_mixer_processor_loop())
        logger.info("🤖 Auto-mixer processor started")
        
        # Start the heat event background scheduler
        try:
            asyncio.create_task(arena_system.run_heat_event_scheduler(db))
            logger.info("🔥 Heat event scheduler started")
        except Exception as _heat_sched_err:
            logger.error(f"🔥 Heat scheduler failed to start: {_heat_sched_err}")
        
        # Start the payment auto-detection loop (optional, non-blocking)
        try:
            tatum_key = AUTO_MIXER_CONFIG.get("tatum_api_key", "")
            if tatum_key and len(tatum_key) > 10:
                asyncio.create_task(payment_check_loop())
                logger.info("💰 Payment auto-detection scheduled")
            else:
                logger.info("⚠️ Payment auto-detection disabled - no valid Tatum API key")
        except Exception as e:
            logger.error(f"⚠️ Failed to start payment checker: {e}")
    
    # Schedule delayed startup as a background task
    asyncio.create_task(delayed_startup())
    logger.info("✅ API ready to accept requests")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    logger.info("Database connection closed")


# Include the router in the main app
#
# CRITICAL: without this call, NONE of the @api_router routes defined
# throughout this file are actually registered with the FastAPI app —
# every request to any /api/* endpoint returns a 404 as if the route
# doesn't exist, which is exactly what "everything fails to fetch on the
# frontend" looks like. This was missing entirely before this fix.
app.include_router(api_router)


# CORS Configuration - always include known frontend domains
#
# CRITICAL: without app.add_middleware(CORSMiddleware, ...) below, browsers
# block every cross-origin request from the frontend (dogefoodlab.xyz)
# to this API's own origin (onrender.com) before it even reaches a route
# handler — this also produces "failed to fetch" on the frontend, on top
# of (or even instead of) the missing-router issue above.
ALLOWED_ORIGINS = os.environ.get('CORS_ORIGINS', '')
# Known frontend domains that should always be allowed
KNOWN_FRONTEND_ORIGINS = [
    "https://www.dogefoodlab.xyz",
    "https://dogefoodlab.xyz",
    "https://doge-food-lab.vercel.app",
    "https://dogefoodlab.vercel.app",
    "http://localhost:3000",
    "https://dogefoodlabfrontend.geovanyquimuanga.workers.dev"
]

if ALLOWED_ORIGINS == '*':
    logging.warning("CORS is set to allow all origins - restrict in production!")
    cors_origins = ["*"]
elif not ALLOWED_ORIGINS:
    cors_origins = KNOWN_FRONTEND_ORIGINS
else:
    cors_origins = [origin.strip() for origin in ALLOWED_ORIGINS.split(',')]
    # Merge with known origins
    for origin in KNOWN_FRONTEND_ORIGINS:
        if origin not in cors_origins:
            cors_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
