// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title LaunchToken
 * @dev ERC20 deployed by LaunchpadFactory for every Lab Launcher token. The
 * full supply is minted straight to BondingCurve at creation - there is no
 * team or presale allocation, and this contract has no owner and no
 * privileged mint/pause/blacklist functions. That is what backs the
 * "Ownership Renounced" / "Contract Verified" trust badges on the token
 * profile: it isn't a claim, it's just true by construction.
 *
 * A swap fee (2%, split 1% treasury / 1% creator royalty) applies ONLY to
 * transfers that touch the registered AMM pair address. Wallet-to-wallet
 * transfers are always free, and bonding-curve trades are never taxed here -
 * BondingCurve charges its own 2% on every buy/sell instead. The AMM pair is
 * set exactly once, by GraduationManager, at the moment liquidity is locked
 * and trading moves to the DEX - so the swap fee only ever activates for a
 * token that has actually graduated.
 */
contract LaunchToken is ERC20 {
    uint256 public constant SWAP_FEE_BPS = 200; // 2% total on AMM-pair transfers
    uint256 public constant BPS_DENOMINATOR = 10_000;

    address public immutable creator;
    address public immutable factory;
    address public immutable treasury;
    address public immutable royaltyDistributor;
    address public immutable graduationManager;

    address public ammPair;
    bool public feesActive;

    event SwapFeeActivated(address indexed pair);

    modifier onlyGraduationManager() {
        require(msg.sender == graduationManager, "LaunchToken: not graduation manager");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        address creator_,
        address curveHolder_,
        address treasury_,
        address royaltyDistributor_,
        address graduationManager_
    ) ERC20(name_, symbol_) {
        require(creator_ != address(0), "LaunchToken: bad creator");
        require(curveHolder_ != address(0), "LaunchToken: bad curve");
        require(treasury_ != address(0), "LaunchToken: bad treasury");
        require(royaltyDistributor_ != address(0), "LaunchToken: bad royalty distributor");
        require(graduationManager_ != address(0), "LaunchToken: bad graduation manager");

        creator = creator_;
        factory = msg.sender;
        treasury = treasury_;
        royaltyDistributor = royaltyDistributor_;
        graduationManager = graduationManager_;

        _mint(curveHolder_, totalSupply_);
    }

    /// @dev Called once by GraduationManager right after it locks liquidity and
    /// creates the DEX pair for this token. Turns on the post-graduation swap fee.
    function activateSwapFee(address pair_) external onlyGraduationManager {
        require(!feesActive, "LaunchToken: already activated");
        require(pair_ != address(0), "LaunchToken: bad pair");
        ammPair = pair_;
        feesActive = true;
        emit SwapFeeActivated(pair_);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (
            feesActive &&
            value > 0 &&
            from != address(0) &&
            to != address(0) &&
            (from == ammPair || to == ammPair)
        ) {
            uint256 fee = (value * SWAP_FEE_BPS) / BPS_DENOMINATOR;
            if (fee > 0) {
                uint256 creatorShare = fee / 2;
                uint256 treasuryShare = fee - creatorShare;
                super._update(from, treasury, treasuryShare);
                super._update(from, royaltyDistributor, creatorShare);
                value -= fee;
            }
        }
        super._update(from, to, value);
    }
}
