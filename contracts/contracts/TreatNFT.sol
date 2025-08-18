// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title TreatNFT
 * @dev NFT contract for DogeFood Lab treat outcomes with metadata storage
 */
contract TreatNFT is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    // Treat metadata structure
    struct TreatMetadata {
        string rarity;           // "Common", "Rare", "Epic", "Legendary"
        string[] ingredients;    // Array of ingredient names used
        uint256 ingredientCount; // Number of ingredients used
        uint256 playerLevel;     // Player level when treat was created
        uint256 seasonId;        // Season ID when treat was created
        uint256 createdAt;       // Timestamp of creation
        address creator;         // Address of the treat creator
        bool isReady;           // Whether treat has completed brewing
        string treatName;        // Name of the treat
    }

    // Mapping from token ID to treat metadata
    mapping(uint256 => TreatMetadata) public treatMetadata;

    // Mapping from creator address to their treat count by season
    mapping(address => mapping(uint256 => uint256)) public creatorSeasonTreats;

    // Mapping from season ID to total treats created
    mapping(uint256 => uint256) public seasonTreatCounts;

    // Mapping from rarity to total count
    mapping(string => uint256) public rarityTotals;

    // Events
    event TreatCreated(
        uint256 indexed tokenId,
        address indexed creator,
        string rarity,
        uint256 ingredientCount,
        uint256 seasonId,
        string treatName
    );

    event TreatCompleted(
        uint256 indexed tokenId,
        address indexed creator,
        uint256 completedAt
    );

    constructor() ERC721("DogeFood Lab Treats", "TREAT") {}

    /**
     * @dev Mint a new treat NFT with complete metadata
     * @param to Address to mint the NFT to
     * @param rarity Rarity of the treat ("Common", "Rare", "Epic", "Legendary")
     * @param ingredients Array of ingredient names used
     * @param playerLevel Player's level when creating the treat
     * @param seasonId Current season ID
     * @param treatName Name of the created treat
     * @return tokenId The ID of the newly minted NFT
     */
    function mintTreat(
        address to,
        string memory rarity,
        string[] memory ingredients,
        uint256 playerLevel,
        uint256 seasonId,
        string memory treatName
    ) public onlyOwner returns (uint256) {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        // Mint the NFT
        _safeMint(to, tokenId);

        // Store metadata
        treatMetadata[tokenId] = TreatMetadata({
            rarity: rarity,
            ingredients: ingredients,
            ingredientCount: ingredients.length,
            playerLevel: playerLevel,
            seasonId: seasonId,
            createdAt: block.timestamp,
            creator: to,
            isReady: false, // Initially not ready (brewing)
            treatName: treatName
        });

        // Update counters
        creatorSeasonTreats[to][seasonId]++;
        seasonTreatCounts[seasonId]++;
        rarityTotals[rarity]++;

        emit TreatCreated(
            tokenId,
            to,
            rarity,
            ingredients.length,
            seasonId,
            treatName
        );

        return tokenId;
    }

    /**
     * @dev Mark a treat as completed (finished brewing)
     * @param tokenId ID of the treat to mark as completed
     */
    function completeTreat(uint256 tokenId) public onlyOwner {
        require(_exists(tokenId), "TreatNFT: treat does not exist");
        require(!treatMetadata[tokenId].isReady, "TreatNFT: treat already completed");

        treatMetadata[tokenId].isReady = true;

        emit TreatCompleted(
            tokenId,
            treatMetadata[tokenId].creator,
            block.timestamp
        );
    }

    /**
     * @dev Batch mint multiple treats (for efficiency)
     * @param recipients Array of addresses to mint to
     * @param rarities Array of rarities for each treat
     * @param ingredientCounts Array of ingredient counts for each treat
     * @param playerLevels Array of player levels for each treat
     * @param seasonId Current season ID (same for all)
     */
    function batchMintTreats(
        address[] memory recipients,
        string[] memory rarities,
        uint256[] memory ingredientCounts,
        uint256[] memory playerLevels,
        uint256 seasonId
    ) public onlyOwner {
        require(
            recipients.length == rarities.length &&
            rarities.length == ingredientCounts.length &&
            ingredientCounts.length == playerLevels.length,
            "TreatNFT: array length mismatch"
        );

        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 tokenId = _tokenIdCounter.current();
            _tokenIdCounter.increment();

            _safeMint(recipients[i], tokenId);

            // Create empty ingredients array for batch minting
            string[] memory emptyIngredients = new string[](0);

            treatMetadata[tokenId] = TreatMetadata({
                rarity: rarities[i],
                ingredients: emptyIngredients,
                ingredientCount: ingredientCounts[i],
                playerLevel: playerLevels[i],
                seasonId: seasonId,
                createdAt: block.timestamp,
                creator: recipients[i],
                isReady: false,
                treatName: "Batch Treat"
            });

            creatorSeasonTreats[recipients[i]][seasonId]++;
            seasonTreatCounts[seasonId]++;
            rarityTotals[rarities[i]]++;
        }
    }

    /**
     * @dev Get complete metadata for a treat
     * @param tokenId ID of the treat
     * @return Complete TreatMetadata struct
     */
    function getTreatMetadata(uint256 tokenId) public view returns (TreatMetadata memory) {
        require(_exists(tokenId), "TreatNFT: treat does not exist");
        return treatMetadata[tokenId];
    }

    /**
     * @dev Get treats by creator address
     * @param creator Address of the creator
     * @return Array of token IDs owned by the creator
     */
    function getTreatsByCreator(address creator) public view returns (uint256[] memory) {
        uint256 creatorBalance = balanceOf(creator);
        uint256[] memory treatIds = new uint256[](creatorBalance);

        for (uint256 i = 0; i < creatorBalance; i++) {
            treatIds[i] = tokenOfOwnerByIndex(creator, i);
        }

        return treatIds;
    }

    /**
     * @dev Get treats by rarity
     * @param rarity Rarity string to filter by
     * @param offset Starting position for pagination
     * @param limit Maximum number of results
     * @return Array of token IDs with the specified rarity
     */
    function getTreatsByRarity(
        string memory rarity,
        uint256 offset,
        uint256 limit
    ) public view returns (uint256[] memory) {
        uint256 totalSupply = totalSupply();
        uint256 found = 0;
        uint256 currentIndex = 0;

        // First pass: count matches after offset
        for (uint256 i = offset; i < totalSupply && found < limit; i++) {
            if (keccak256(bytes(treatMetadata[i].rarity)) == keccak256(bytes(rarity))) {
                found++;
            }
        }

        // Second pass: collect token IDs
        uint256[] memory results = new uint256[](found);
        found = 0;
        for (uint256 i = offset; i < totalSupply && found < limit; i++) {
            if (keccak256(bytes(treatMetadata[i].rarity)) == keccak256(bytes(rarity))) {
                results[found] = i;
                found++;
            }
        }

        return results;
    }

    /**
     * @dev Get treats by season
     * @param seasonId Season ID to filter by
     * @param offset Starting position for pagination
     * @param limit Maximum number of results
     * @return Array of token IDs from the specified season
     */
    function getTreatsBySeason(
        uint256 seasonId,
        uint256 offset,
        uint256 limit
    ) public view returns (uint256[] memory) {
        uint256 totalSupply = totalSupply();
        uint256 found = 0;

        // First pass: count matches after offset
        for (uint256 i = offset; i < totalSupply && found < limit; i++) {
            if (treatMetadata[i].seasonId == seasonId) {
                found++;
            }
        }

        // Second pass: collect token IDs
        uint256[] memory results = new uint256[](found);
        found = 0;
        for (uint256 i = offset; i < totalSupply && found < limit; i++) {
            if (treatMetadata[i].seasonId == seasonId) {
                results[found] = i;
                found++;
            }
        }

        return results;
    }

    /**
     * @dev Get statistics for a specific season
     * @param seasonId Season ID to get stats for
     * @return totalTreats Total treats created in season
     * @return uniqueCreators Number of unique creators in season
     * @return commonCount Number of common treats
     * @return rareCount Number of rare treats
     * @return epicCount Number of epic treats
     * @return legendaryCount Number of legendary treats
     */
    function getSeasonStats(uint256 seasonId) public view returns (
        uint256 totalTreats,
        uint256 uniqueCreators,
        uint256 commonCount,
        uint256 rareCount,
        uint256 epicCount,
        uint256 legendaryCount
    ) {
        uint256 totalSupply = totalSupply();
        
        // Use a mapping to track unique creators (in a real implementation, 
        // this would be more gas-efficient if done off-chain)
        mapping(address => bool) storage uniqueCreatorMap;
        
        for (uint256 i = 0; i < totalSupply; i++) {
            if (treatMetadata[i].seasonId == seasonId) {
                totalTreats++;
                
                // Count rarity distribution
                if (keccak256(bytes(treatMetadata[i].rarity)) == keccak256(bytes("Common"))) {
                    commonCount++;
                } else if (keccak256(bytes(treatMetadata[i].rarity)) == keccak256(bytes("Rare"))) {
                    rareCount++;
                } else if (keccak256(bytes(treatMetadata[i].rarity)) == keccak256(bytes("Epic"))) {
                    epicCount++;
                } else if (keccak256(bytes(treatMetadata[i].rarity)) == keccak256(bytes("Legendary"))) {
                    legendaryCount++;
                }
            }
        }

        // Note: uniqueCreators calculation is simplified here
        // In production, this would be better handled off-chain or with events
        uniqueCreators = totalTreats; // Placeholder
    }

    /**
     * @dev Get global contract statistics
     * @return totalTreats Total number of treats ever created
     * @return totalCommon Total common treats
     * @return totalRare Total rare treats
     * @return totalEpic Total epic treats
     * @return totalLegendary Total legendary treats
     */
    function getGlobalStats() public view returns (
        uint256 totalTreats,
        uint256 totalCommon,
        uint256 totalRare,
        uint256 totalEpic,
        uint256 totalLegendary
    ) {
        totalTreats = totalSupply();
        totalCommon = rarityTotals["Common"];
        totalRare = rarityTotals["Rare"];
        totalEpic = rarityTotals["Epic"];
        totalLegendary = rarityTotals["Legendary"];
    }

    // Override required functions for multiple inheritance
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}