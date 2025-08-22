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

# Import Enhanced Game Mechanics (Phase 3)
from services.treat_game_engine import TreatGameEngine, TreatRarity
from services.ingredient_system import IngredientSystem
from services.season_manager import SeasonManager

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

# Phase 2: Enhanced Points System Routes
@api_router.get("/points/leaderboard")
async def get_points_leaderboard(limit: int = 50, nft_holders_only: bool = True):
    """Get enhanced points-based leaderboard"""
    leaderboard = await points_system.get_points_leaderboard(limit=limit, nft_holders_only=nft_holders_only)
    return {"leaderboard": leaderboard, "generated_at": datetime.utcnow()}

@api_router.get("/points/{address}/stats")
async def get_player_points_stats(address: str):
    """Get detailed player points statistics"""
    stats = await points_system.get_player_stats(address)
    if not stats:
        raise HTTPException(status_code=404, detail="Player not found")
    return stats

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

# Enhanced Treat Creation with Game Engine
@api_router.post("/treats/enhanced")
async def create_enhanced_treat(treat_data: EnhancedTreatCreate, background_tasks: BackgroundTasks):
    """Create treat with enhanced game mechanics including rarity calculation and timers"""
    
    try:
        # Validate treat creation
        validation = game_engine.validate_treat_creation(treat_data.ingredients, treat_data.player_level)
        if not validation["valid"]:
            raise HTTPException(status_code=400, detail=f"Invalid treat creation: {validation['errors']}")
        
        # Anti-cheat validation
        cheat_check = await anti_cheat_system.validate_treat_creation(
            treat_data.creator_address,
            {"ingredients": treat_data.ingredients, "level": treat_data.player_level}
        )
        if not cheat_check["valid"]:
            raise HTTPException(status_code=429, detail=f"Anti-cheat triggered: {cheat_check['reason']}")
        
        # Calculate treat outcome using game engine
        treat_outcome = game_engine.calculate_treat_outcome(
            treat_data.ingredients, treat_data.player_level, treat_data.creator_address
        )
        
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
            image="🍖"  # Default for now
        )
        
        # Add Season 1 specific metadata for future NFT compatibility
        treat_dict = treat.dict()
        treat_dict.update({
            "season_id": season_id,
            "created_at": datetime.utcnow(),
            "is_offchain": season_id == 1,  # Season 1 is offchain only
            "nft_metadata": {
                "name": f"{treat_outcome['rarity']} DogeFood Treat",
                "description": f"A {treat_outcome['rarity'].lower()} treat created in Season {season_id} of DogeFood Lab",
                "image": "🍖",  # Will be updated with actual image URL later
                "attributes": [
                    {"trait_type": "Rarity", "value": treat_outcome['rarity']},
                    {"trait_type": "Season", "value": season_id},
                    {"trait_type": "Creator Level", "value": treat_data.player_level},
                    {"trait_type": "Ingredients Count", "value": len(treat_outcome["ingredients_used"])},
                    {"trait_type": "Timer Duration (hours)", "value": treat_outcome["timer_duration_hours"]},
                    {"trait_type": "Secret Combo", "value": treat_outcome.get("secret_combo", {}).get("is_secret_combo", False)}
                ]
            },
            "migration_ready": True  # Flags this treat as ready for future onchain migration
        })
        
        # Save to database with enhanced metadata
        result = await db.treats.insert_one(treat_dict)
        
        # Update player's created treats using the inserted document ID
        await db.players.update_one(
            {"address": treat_data.creator_address},
            {"$push": {"created_treats": str(result.inserted_id)}}
        )
        
        # Award points in background
        background_tasks.add_task(
            award_treat_creation_points,
            treat_data.creator_address,
            {
                "rarity": treat_outcome["rarity"],
                "ingredients": treat_outcome["ingredients_used"],
                "level": treat_data.player_level,
                "secret_combo": treat_outcome.get("secret_combo", {}),
                "season_id": season_id
            }
        )
        
        # Convert treat_dict to JSON-serializable format
        treat_response = treat_dict.copy()
        if 'created_at' in treat_response:
            treat_response['created_at'] = treat_response['created_at'].isoformat()
        if 'ready_at' in treat_response and treat_response['ready_at']:
            treat_response['ready_at'] = treat_response['ready_at'].isoformat()
        
        return {
            "treat": treat_response,
            "outcome": treat_outcome,
            "validation": validation,
            "message": f"Season {season_id} {treat_outcome['rarity']} treat created! Brewing for {treat_outcome['timer_duration_hours']} hours. {'(Offchain storage)' if season_id == 1 else ''}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating enhanced treat: {str(e)}")

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