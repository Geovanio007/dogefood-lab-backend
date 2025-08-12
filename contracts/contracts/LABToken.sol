// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LABToken is ERC20, Ownable {
    uint256 public constant TOTAL_SUPPLY = 420_000_000 * 10**18; // 420M tokens
    
    uint256 public constant COMMUNITY_ALLOCATION = 294_000_000 * 10**18; // 70%
    uint256 public constant PUBLIC_SALE_ALLOCATION = 42_000_000 * 10**18; // 10%
    uint256 public constant LIQUIDITY_ALLOCATION = 42_000_000 * 10**18; // 10%
    uint256 public constant MARKETING_ALLOCATION = 21_000_000 * 10**18; // 5%
    uint256 public constant TEAM_ALLOCATION = 21_000_000 * 10**18; // 5%
    
    address public rewardDistributor;
    address public teamVesting;
    
    uint256 public teamCliffEnd;
    uint256 public teamVestingEnd;
    uint256 public teamTokensReleased;
    
    event TeamTokensReleased(uint256 amount);
    event RewardDistributorUpdated(address indexed newDistributor);
    
    constructor(
        address _owner,
        address _rewardDistributor,
        address _publicSale,
        address _liquidity,
        address _marketing,
        address _teamVesting
    ) ERC20("LAB Token", "LAB") Ownable(_owner) {
        rewardDistributor = _rewardDistributor;
        teamVesting = _teamVesting;
        
        // Set team vesting schedule: 12-month cliff, 24-month vesting
        teamCliffEnd = block.timestamp + 365 days;
        teamVestingEnd = teamCliffEnd + 365 days;
        
        // Mint allocations
        if (_rewardDistributor != address(0)) {
            _mint(_rewardDistributor, COMMUNITY_ALLOCATION);
        } else {
            _mint(address(this), COMMUNITY_ALLOCATION); // Hold until distributor is set
        }
        _mint(_publicSale, PUBLIC_SALE_ALLOCATION);
        _mint(_liquidity, LIQUIDITY_ALLOCATION);
        _mint(_marketing, MARKETING_ALLOCATION);
        _mint(address(this), TEAM_ALLOCATION); // Hold team tokens for vesting
    }
    
    function setRewardDistributor(address _rewardDistributor) external onlyOwner {
        require(_rewardDistributor != address(0), "Invalid address");
        
        // If community tokens are held by contract, transfer to distributor
        if (rewardDistributor == address(0) && balanceOf(address(this)) >= COMMUNITY_ALLOCATION) {
            _transfer(address(this), _rewardDistributor, COMMUNITY_ALLOCATION);
        }
        
        rewardDistributor = _rewardDistributor;
        emit RewardDistributorUpdated(_rewardDistributor);
    }
    
    function releaseTeamTokens() external {
        require(block.timestamp >= teamCliffEnd, "Cliff period not ended");
        require(teamTokensReleased < TEAM_ALLOCATION, "All team tokens released");
        
        uint256 releasable = _calculateReleasableAmount();
        require(releasable > 0, "No tokens to release");
        
        teamTokensReleased += releasable;
        _transfer(address(this), teamVesting, releasable);
        
        emit TeamTokensReleased(releasable);
    }
    
    function _calculateReleasableAmount() private view returns (uint256) {
        if (block.timestamp < teamCliffEnd) {
            return 0;
        }
        
        uint256 totalReleasable;
        if (block.timestamp >= teamVestingEnd) {
            totalReleasable = TEAM_ALLOCATION;
        } else {
            uint256 vestingDuration = teamVestingEnd - teamCliffEnd;
            uint256 elapsedTime = block.timestamp - teamCliffEnd;
            totalReleasable = (TEAM_ALLOCATION * elapsedTime) / vestingDuration;
        }
        
        return totalReleasable - teamTokensReleased;
    }
    
    function getReleasableAmount() external view returns (uint256) {
        return _calculateReleasableAmount();
    }
}