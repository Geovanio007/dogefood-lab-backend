// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RoyaltyDistributor
 * @dev Holds each launched token's creator-royalty share of the post-
 * graduation swap fee, and lets that creator claim it. LaunchToken's swap
 * fee sends the creator's half of every taxed transfer directly here as a
 * plain ERC20 transfer - there is no separate bookkeeping call, because a
 * token only ever registers one creator and only its own tax mechanism ever
 * sends it here. That means this contract's current balance of a given
 * token IS that creator's unclaimed royalty, which is what claim() reads.
 */
contract RoyaltyDistributor is Ownable, ReentrancyGuard {
    address public factory;

    mapping(address => address) public creatorOf; // launched token => creator

    event FactoryUpdated(address indexed factory);
    event TokenRegistered(address indexed token, address indexed creator);
    event RoyaltyClaimed(address indexed token, address indexed creator, uint256 amount);

    modifier onlyFactory() {
        require(msg.sender == factory, "RoyaltyDistributor: not factory");
        _;
    }

    constructor(address owner_) Ownable(owner_) {}

    function setFactory(address factory_) external onlyOwner {
        require(factory_ != address(0), "RoyaltyDistributor: bad factory");
        factory = factory_;
        emit FactoryUpdated(factory_);
    }

    /// @dev Called once by LaunchpadFactory when a new token is created.
    function registerToken(address token, address creator_) external onlyFactory {
        require(token != address(0), "RoyaltyDistributor: bad token");
        require(creator_ != address(0), "RoyaltyDistributor: bad creator");
        require(creatorOf[token] == address(0), "RoyaltyDistributor: already registered");
        creatorOf[token] = creator_;
        emit TokenRegistered(token, creator_);
    }

    /// @dev Returns the caller's unclaimed royalty balance for a token.
    function pendingRoyalty(address token) external view returns (uint256) {
        if (creatorOf[token] == address(0)) return 0;
        return IERC20(token).balanceOf(address(this));
    }

    function claim(address token) external nonReentrant {
        require(creatorOf[token] == msg.sender, "RoyaltyDistributor: not creator");
        uint256 amount = IERC20(token).balanceOf(address(this));
        require(amount > 0, "RoyaltyDistributor: nothing to claim");
        require(IERC20(token).transfer(msg.sender, amount), "RoyaltyDistributor: transfer failed");
        emit RoyaltyClaimed(token, msg.sender, amount);
    }
}
