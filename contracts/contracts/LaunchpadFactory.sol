// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./LaunchToken.sol";

interface IBondingCurveRegister {
    function registerToken(address token, address creator) external;
}

interface IRoyaltyDistributorRegister {
    function registerToken(address token, address creator) external;
}

/**
 * @title LaunchpadFactory
 * @dev Entry point for "create a token in under a minute": takes a name and
 * symbol, deploys a LaunchToken with the full fixed supply minted straight
 * to BondingCurve, and registers it with both BondingCurve (so it can be
 * bought and sold) and RoyaltyDistributor (so the creator has somewhere to
 * claim from after graduation). There's no launch fee - the only cost is
 * gas. Everything else in the spec's "Create Token" form (description,
 * logo, website, X, Telegram) is off-chain metadata that the backend stores
 * against the token address this contract emits, not on-chain state.
 */
contract LaunchpadFactory is Ownable {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether; // fixed for every launch, no presale/team allocation

    address public immutable bondingCurve;
    address public immutable royaltyDistributor;
    address public immutable treasury;
    address public immutable graduationManager;

    address[] public allTokens;

    event TokenLaunched(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint256 totalSupply,
        uint256 index
    );

    constructor(
        address bondingCurve_,
        address royaltyDistributor_,
        address treasury_,
        address graduationManager_,
        address owner_
    ) Ownable(owner_) {
        require(bondingCurve_ != address(0), "LaunchpadFactory: bad bonding curve");
        require(royaltyDistributor_ != address(0), "LaunchpadFactory: bad royalty distributor");
        require(treasury_ != address(0), "LaunchpadFactory: bad treasury");
        require(graduationManager_ != address(0), "LaunchpadFactory: bad graduation manager");
        bondingCurve = bondingCurve_;
        royaltyDistributor = royaltyDistributor_;
        treasury = treasury_;
        graduationManager = graduationManager_;
    }

    function createToken(string calldata name, string calldata symbol) external returns (address token) {
        require(bytes(name).length > 0, "LaunchpadFactory: name required");
        require(bytes(symbol).length > 0, "LaunchpadFactory: symbol required");

        token = address(
            new LaunchToken(
                name,
                symbol,
                TOTAL_SUPPLY,
                msg.sender,
                bondingCurve,
                treasury,
                royaltyDistributor,
                graduationManager
            )
        );

        IBondingCurveRegister(bondingCurve).registerToken(token, msg.sender);
        IRoyaltyDistributorRegister(royaltyDistributor).registerToken(token, msg.sender);

        allTokens.push(token);

        emit TokenLaunched(token, msg.sender, name, symbol, TOTAL_SUPPLY, allTokens.length - 1);
    }

    function totalTokensLaunched() external view returns (uint256) {
        return allTokens.length;
    }
}
