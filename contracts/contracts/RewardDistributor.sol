// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract RewardDistributor is Ownable, ReentrancyGuard {
    IERC20 public immutable labToken;
    
    struct Season {
        bytes32 merkleRoot;
        uint256 startTime;
        uint256 endTime;
        uint256 totalRewards;
        bool active;
        mapping(address => uint256) claimed;
        uint256 totalClaimed;
    }
    
    mapping(uint256 => Season) public seasons;
    uint256 public currentSeason;
    uint256 public constant UNCLAIMED_PERIOD = 180 days; // 6 months
    
    event SeasonCreated(uint256 indexed seasonId, bytes32 merkleRoot, uint256 startTime, uint256 endTime, uint256 totalRewards);
    event RewardClaimed(uint256 indexed seasonId, address indexed user, uint256 amount);
    event SeasonClosed(uint256 indexed seasonId, uint256 unclaimedAmount);
    event UnclaimedTokensRecovered(uint256 indexed seasonId, uint256 amount);
    
    constructor(address _labToken, address _owner) Ownable(_owner) {
        labToken = IERC20(_labToken);
    }
    
    function createSeason(
        bytes32 _merkleRoot,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _totalRewards
    ) external onlyOwner {
        require(_startTime < _endTime, "Invalid time range");
        require(_endTime > block.timestamp, "End time in past");
        require(_totalRewards > 0, "Invalid reward amount");
        require(labToken.balanceOf(address(this)) >= _totalRewards, "Insufficient balance");
        
        currentSeason++;
        Season storage season = seasons[currentSeason];
        season.merkleRoot = _merkleRoot;
        season.startTime = _startTime;
        season.endTime = _endTime;
        season.totalRewards = _totalRewards;
        season.active = true;
        
        emit SeasonCreated(currentSeason, _merkleRoot, _startTime, _endTime, _totalRewards);
    }
    
    function claimReward(
        uint256 seasonId,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external nonReentrant {
        Season storage season = seasons[seasonId];
        require(season.active, "Season not active");
        require(block.timestamp >= season.startTime, "Season not started");
        require(block.timestamp <= season.endTime, "Season ended");
        require(season.claimed[msg.sender] == 0, "Already claimed");
        
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        require(MerkleProof.verify(merkleProof, season.merkleRoot, leaf), "Invalid proof");
        
        season.claimed[msg.sender] = amount;
        season.totalClaimed += amount;
        
        require(labToken.transfer(msg.sender, amount), "Transfer failed");
        
        emit RewardClaimed(seasonId, msg.sender, amount);
    }
    
    function closeSeason(uint256 seasonId) external onlyOwner {
        Season storage season = seasons[seasonId];
        require(season.active, "Season not active");
        require(block.timestamp > season.endTime + UNCLAIMED_PERIOD, "Unclaimed period not ended");
        
        season.active = false;
        uint256 unclaimedAmount = season.totalRewards - season.totalClaimed;
        
        if (unclaimedAmount > 0) {
            // Return unclaimed tokens to treasury (owner)
            require(labToken.transfer(owner(), unclaimedAmount), "Transfer failed");
            emit UnclaimedTokensRecovered(seasonId, unclaimedAmount);
        }
        
        emit SeasonClosed(seasonId, unclaimedAmount);
    }
    
    function hasClaimedSeason(uint256 seasonId, address user) external view returns (bool) {
        return seasons[seasonId].claimed[user] > 0;
    }
    
    function getClaimedAmount(uint256 seasonId, address user) external view returns (uint256) {
        return seasons[seasonId].claimed[user];
    }
    
    function getSeasonInfo(uint256 seasonId) external view returns (
        bytes32 merkleRoot,
        uint256 startTime,
        uint256 endTime,
        uint256 totalRewards,
        uint256 totalClaimed,
        bool active
    ) {
        Season storage season = seasons[seasonId];
        return (
            season.merkleRoot,
            season.startTime,
            season.endTime,
            season.totalRewards,
            season.totalClaimed,
            season.active
        );
    }
    
    // Emergency function to recover tokens if needed
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(labToken.transfer(owner(), amount), "Transfer failed");
    }
}