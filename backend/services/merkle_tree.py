"""
Merkle Tree generation for Web3 rewards distribution
Handles creation of Merkle proofs for claiming $LAB tokens
"""

import hashlib
import json
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import logging
from Crypto.Hash import keccak

logger = logging.getLogger(__name__)

@dataclass
class RewardEntry:
    address: str
    amount: int  # Amount in smallest unit (wei for tokens)
    season: int
    tier: str  # "bronze", "silver", "gold", "diamond"

@dataclass
class MerkleProof:
    address: str
    amount: int
    season: int
    proof: List[str]
    leaf_hash: str

class MerkleTreeGenerator:
    def __init__(self):
        self.TIER_MULTIPLIERS = {
            "bronze": 1.0,
            "silver": 1.5, 
            "gold": 2.0,
            "diamond": 3.0
        }
        
        # $LAB token has 18 decimals
        self.TOKEN_DECIMALS = 18
        self.WEI_MULTIPLIER = 1000000000000000000  # 10^18 as literal to avoid overflow
    
    def generate_rewards_for_season(self, player_stats: List[Dict], season: int, total_reward_pool: int) -> List[RewardEntry]:
        """
        Generate reward allocations for a season based on player performance
        
        Args:
            player_stats: List of player statistics with points, level, activity
            season: Season number
            total_reward_pool: Total $LAB tokens to distribute (in whole tokens)
            
        Returns:
            List of RewardEntry objects
        """
        
        if not player_stats:
            return []
        
        # Convert total pool to wei
        total_pool_wei = total_reward_pool * self.WEI_MULTIPLIER
        
        # Calculate tiers based on performance
        rewards = []
        total_weight = 0
        
        # First pass: categorize players and calculate weights
        categorized_players = []
        for player in player_stats:
            tier = self._calculate_player_tier(player)
            weight = self._calculate_player_weight(player, tier)
            
            categorized_players.append({
                **player,
                "tier": tier,
                "weight": weight
            })
            total_weight += weight
        
        # Second pass: allocate rewards based on weights
        for player in categorized_players:
            if total_weight > 0:
                reward_amount = int((player["weight"] / total_weight) * total_pool_wei)
                
                # Minimum reward check (at least 1 token)
                min_reward = self.WEI_MULTIPLIER  # 1 token
                reward_amount = max(reward_amount, min_reward)
                
                reward_entry = RewardEntry(
                    address=player["address"],
                    amount=reward_amount,
                    season=season,
                    tier=player["tier"]
                )
                
                rewards.append(reward_entry)
        
        logger.info(f"Generated {len(rewards)} reward entries for season {season}")
        logger.info(f"Total rewards allocated: {sum(r.amount for r in rewards) / self.WEI_MULTIPLIER:.2f} LAB tokens")
        
        return rewards
    
    def _calculate_player_tier(self, player_stats: Dict) -> str:
        """Calculate player tier based on performance metrics"""
        
        points = player_stats.get("points", 0)
        level = player_stats.get("level", 1)
        treats_created = player_stats.get("treats_created", 0)
        activity_score = player_stats.get("activity_score", 0)  # Based on login streak, etc.
        
        # Composite score calculation
        score = (
            points * 1.0 +                    # Points are primary
            level * 50 +                      # Level progression
            treats_created * 25 +             # Creativity bonus
            activity_score * 10               # Activity bonus
        )
        
        # Tier thresholds (adjust based on game economics)
        if score >= 10000:
            return "diamond"
        elif score >= 5000:
            return "gold"
        elif score >= 2000:
            return "silver"
        else:
            return "bronze"
    
    def _calculate_player_weight(self, player_stats: Dict, tier: str) -> float:
        """Calculate player's weight in reward distribution"""
        
        base_weight = player_stats.get("points", 0)
        tier_multiplier = self.TIER_MULTIPLIERS[tier]
        
        # Additional bonuses
        level_bonus = player_stats.get("level", 1) * 10
        activity_bonus = min(player_stats.get("activity_score", 0) * 5, 500)  # Cap activity bonus
        
        total_weight = (base_weight + level_bonus + activity_bonus) * tier_multiplier
        
        return max(total_weight, 1.0)  # Minimum weight of 1
    
    def generate_merkle_tree(self, rewards: List[RewardEntry]) -> Dict:
        """
        Generate Merkle tree from reward entries
        
        Returns:
            Dict with merkle_root, leaves, and tree structure
        """
        
        if not rewards:
            return {"merkle_root": "0x0", "leaves": [], "tree": []}
        
        # Create leaves (leaf = keccak256(abi.encodePacked(address, amount)))
        leaves = []
        for reward in rewards:
            leaf_hash = self._create_leaf_hash(reward.address, reward.amount)
            leaves.append({
                "address": reward.address,
                "amount": reward.amount,
                "tier": reward.tier,
                "season": reward.season,
                "hash": leaf_hash
            })
        
        # Sort leaves for consistent tree generation
        leaves.sort(key=lambda x: x["hash"])
        leaf_hashes = [leaf["hash"] for leaf in leaves]
        
        # Build Merkle tree
        tree = self._build_merkle_tree(leaf_hashes)
        merkle_root = tree[-1][0] if tree else "0x0"
        
        logger.info(f"Generated Merkle tree with root: {merkle_root}")
        logger.info(f"Total leaves: {len(leaves)}")
        
        return {
            "merkle_root": merkle_root,
            "leaves": leaves,
            "tree": tree,
            "total_rewards": sum(r.amount for r in rewards),
            "total_recipients": len(rewards)
        }
    
    def generate_merkle_proofs(self, merkle_data: Dict) -> Dict[str, MerkleProof]:
        """
        Generate Merkle proofs for all addresses
        
        Returns:
            Dict mapping address -> MerkleProof
        """
        
        proofs = {}
        leaves = merkle_data["leaves"]
        tree = merkle_data["tree"]
        
        for i, leaf in enumerate(leaves):
            proof_path = self._get_merkle_proof(tree, i)
            
            merkle_proof = MerkleProof(
                address=leaf["address"],
                amount=leaf["amount"],
                season=leaf["season"],
                proof=proof_path,
                leaf_hash=leaf["hash"]
            )
            
            proofs[leaf["address"]] = merkle_proof
        
        return proofs
    
    def _create_leaf_hash(self, address: str, amount: int) -> str:
        """Create leaf hash for Merkle tree (compatible with Solidity)"""
        
        # Remove '0x' prefix if present
        clean_address = address.lower().replace('0x', '')
        
        # Convert amount to 32-byte hex
        amount_hex = format(amount, '064x')
        
        # Concatenate and hash (similar to abi.encodePacked)
        combined = clean_address + amount_hex
        k = keccak.new(digest_bits=256)
        k.update(bytes.fromhex(combined))
        hash_bytes = k.digest()
        
        return '0x' + hash_bytes.hex()
    
    def _build_merkle_tree(self, leaves: List[str]) -> List[List[str]]:
        """Build Merkle tree from leaf hashes"""
        
        if not leaves:
            return []
        
        tree = [leaves.copy()]
        
        while len(tree[-1]) > 1:
            current_level = tree[-1]
            next_level = []
            
            # Process pairs
            for i in range(0, len(current_level), 2):
                left = current_level[i]
                
                if i + 1 < len(current_level):
                    right = current_level[i + 1]
                else:
                    right = left  # Duplicate last node if odd number
                
                # Create parent hash
                parent = self._hash_pair(left, right)
                next_level.append(parent)
            
            tree.append(next_level)
        
        return tree
    
    def _hash_pair(self, left: str, right: str) -> str:
        """Hash a pair of nodes (compatible with Solidity)"""
        
        # Remove '0x' prefix
        left_clean = left.replace('0x', '')
        right_clean = right.replace('0x', '')
        
        # Sort for consistent hashing (prevents second preimage attacks)
        if left_clean <= right_clean:
            combined = left_clean + right_clean
        else:
            combined = right_clean + left_clean
        
        k = keccak.new(digest_bits=256)
        k.update(bytes.fromhex(combined))
        hash_bytes = k.digest()
        return '0x' + hash_bytes.hex()
    
    def _get_merkle_proof(self, tree: List[List[str]], leaf_index: int) -> List[str]:
        """Get Merkle proof path for a specific leaf"""
        
        if not tree or leaf_index >= len(tree[0]):
            return []
        
        proof = []
        current_index = leaf_index
        
        # Traverse up the tree
        for level in range(len(tree) - 1):
            current_level = tree[level]
            
            # Find sibling
            if current_index % 2 == 0:  # Left node
                sibling_index = current_index + 1
            else:  # Right node
                sibling_index = current_index - 1
            
            # Add sibling to proof if it exists
            if sibling_index < len(current_level):
                proof.append(current_level[sibling_index])
            else:
                # Duplicate current node if no sibling
                proof.append(current_level[current_index])
            
            # Move to parent index
            current_index = current_index // 2
        
        return proof
    
    def verify_merkle_proof(self, address: str, amount: int, proof: List[str], merkle_root: str) -> bool:
        """Verify a Merkle proof"""
        
        # Create leaf hash
        leaf_hash = self._create_leaf_hash(address, amount)
        current_hash = leaf_hash
        
        # Apply proof
        for proof_element in proof:
            current_hash = self._hash_pair(current_hash, proof_element)
        
        return current_hash.lower() == merkle_root.lower()
    
    def export_for_smart_contract(self, merkle_data: Dict, proofs: Dict[str, MerkleProof], season: int) -> Dict:
        """Export data in format suitable for smart contract deployment"""
        
        # Prepare claim data for each address
        claim_data = {}
        for address, proof in proofs.items():
            claim_data[address] = {
                "amount": str(proof.amount),
                "proof": proof.proof
            }
        
        contract_data = {
            "season": season,
            "merkle_root": merkle_data["merkle_root"],
            "total_amount": str(merkle_data["total_rewards"]),
            "recipient_count": merkle_data["total_recipients"],
            "claim_data": claim_data,
            "generated_at": datetime.utcnow().isoformat(),
            "expires_after_days": 180  # Unclaimed tokens return after 180 days
        }
        
        return contract_data
    
    def generate_season_summary(self, rewards: List[RewardEntry], merkle_root: str) -> Dict:
        """Generate summary statistics for a season"""
        
        if not rewards:
            return {}
        
        # Calculate tier distribution
        tier_stats = {}
        for tier in self.TIER_MULTIPLIERS.keys():
            tier_rewards = [r for r in rewards if r.tier == tier]
            tier_stats[tier] = {
                "count": len(tier_rewards),
                "total_amount": sum(r.amount for r in tier_rewards),
                "avg_amount": sum(r.amount for r in tier_rewards) / len(tier_rewards) if tier_rewards else 0
            }
        
        # Overall statistics
        total_amount = sum(r.amount for r in rewards)
        
        summary = {
            "season": rewards[0].season,
            "merkle_root": merkle_root,
            "total_recipients": len(rewards),
            "total_amount_wei": total_amount,
            "total_amount_tokens": total_amount / self.WEI_MULTIPLIER,
            "tier_distribution": tier_stats,
            "min_reward": min(r.amount for r in rewards),
            "max_reward": max(r.amount for r in rewards),
            "avg_reward": total_amount / len(rewards),
            "generated_at": datetime.utcnow().isoformat()
        }
        
        return summary