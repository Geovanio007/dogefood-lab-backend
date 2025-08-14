from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime

# Import Phase 2 services
from services.anti_cheat import AntiCheatSystem
from services.points_system import PointsCollectionSystem
from services.merkle_tree import MerkleTreeGenerator

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize Phase 2 services
anti_cheat_system = AntiCheatSystem(db)
points_system = PointsCollectionSystem(db)
merkle_generator = MerkleTreeGenerator()

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

# Game Models
class Player(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    address: str
    nickname: Optional[str] = None  # Enhanced: Add nickname support
    is_nft_holder: bool = False
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
    rank: int

# Player Management Routes
@api_router.post("/player", response_model=Player)
async def create_player(player_data: PlayerCreate):
    # Check if player already exists
    existing_player = await db.players.find_one({"address": player_data.address})
    if existing_player:
        return Player(**existing_player)
    
    player = Player(
        address=player_data.address,
        nickname=player_data.nickname,  # Enhanced: Store nickname
        is_nft_holder=player_data.is_nft_holder
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
    
    # Phase 2: Award points for treat creation
    background_tasks.add_task(
        award_treat_creation_points,
        treat_data.creator_address,
        {
            "rarity": treat_data.rarity,
            "ingredients": treat_data.ingredients,
            "main_ingredient": treat_data.main_ingredient
        }
    )
    
    return treat

@api_router.get("/treats/{address}", response_model=List[DogeTreat])
async def get_player_treats(address: str):
    treats = await db.treats.find({"creator_address": address}).to_list(1000)
    return [DogeTreat(**treat) for treat in treats]

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
    """Get all treats currently brewing for a player"""
    brewing_treats = await db.treats.find({
        "creator_address": address,
        "brewing_status": "brewing"
    }).to_list(100)
    
    # Update status for any completed treats
    updated_treats = []
    for treat in brewing_treats:
        if treat.get("ready_at") and datetime.utcnow() >= treat["ready_at"]:
            # Auto-update to ready
            await db.treats.update_one(
                {"id": treat["id"]},
                {"$set": {"brewing_status": "ready"}}
            )
            treat["brewing_status"] = "ready"
        updated_treats.append(DogeTreat(**treat))
    
    return updated_treats

# Leaderboard Routes
@api_router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard(limit: int = 50):
    # Get top players by points (NFT holders only)
    pipeline = [
        {"$match": {"is_nft_holder": True, "points": {"$gt": 0}}},
        {"$sort": {"points": -1, "level": -1}},
        {"$limit": limit}
    ]
    
    top_players = await db.players.aggregate(pipeline).to_list(limit)
    
    leaderboard = []
    for rank, player in enumerate(top_players, 1):
        leaderboard.append(LeaderboardEntry(
            address=player["address"],
            nickname=player.get("nickname"),  # Enhanced: Include nickname
            points=player["points"],
            level=player["level"],
            is_nft_holder=player["is_nft_holder"],
            rank=rank
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

# NFT Verification Route (Mock for prototype)
@api_router.post("/verify-nft/{address}")
async def verify_nft_ownership(address: str):
    # Mock NFT verification - in production, this would check actual blockchain
    mock_nft_holders = [
        "0x1234567890123456789012345678901234567890",
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
    ]
    
    is_holder = address.lower() in [addr.lower() for addr in mock_nft_holders]
    
    # Update player NFT status
    await db.players.update_one(
        {"address": address},
        {"$set": {"is_nft_holder": is_holder}},
        upsert=True
    )
    
    return {"address": address, "is_nft_holder": is_holder}

# Health check
@api_router.get("/")
async def root():
    return {"message": "DogeFood Lab API is running! 🐕🧪"}

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()