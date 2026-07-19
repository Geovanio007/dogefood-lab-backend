// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IBondingCurveGraduation {
    function isGraduated(address token) external view returns (bool);
}

/**
 * @title GamePaymentGateway
 * @dev Single entry point for in-game spending that isn't LAB's existing
 * reward flow: extra lives, marketplace purchases, Lab Surge wagers,
 * tournament entries, and anything future utilities add. Accepts native
 * DOGE, the LAB token, or any token that has graduated off its bonding
 * curve - unlaunched or still-bonding tokens are rejected, so a curve can't
 * be used for in-game spend before the market has actually vetted it.
 *
 * This contract doesn't track game state (lives, wager pots, purchase
 * history) - that lives in the backend's Game Payments collection, keyed
 * off the payment_id in the PaymentReceived event below. It just verifies
 * the payment is in an accepted currency and forwards it to LauncherTreasury.
 * Payouts (e.g. a Lab Surge winner receiving the pot) go back out the same
 * way any protocol spend does, as a Treasury owner withdrawal, rather than
 * this contract holding funds in escrow.
 */
contract GamePaymentGateway is Ownable, ReentrancyGuard {
    address public immutable labToken;
    address public bondingCurve;
    address payable public treasury;

    uint256 public nextPaymentId = 1;

    event BondingCurveUpdated(address indexed bondingCurve);
    event TreasuryUpdated(address indexed treasury);
    event PaymentReceived(
        uint256 indexed paymentId,
        address indexed payer,
        address token,
        uint256 amount,
        string feature
    );

    constructor(address labToken_, address bondingCurve_, address payable treasury_, address owner_) Ownable(owner_) {
        require(labToken_ != address(0), "GamePaymentGateway: bad LAB token");
        require(bondingCurve_ != address(0), "GamePaymentGateway: bad bonding curve");
        require(treasury_ != address(0), "GamePaymentGateway: bad treasury");
        labToken = labToken_;
        bondingCurve = bondingCurve_;
        treasury = treasury_;
    }

    function setBondingCurve(address bondingCurve_) external onlyOwner {
        require(bondingCurve_ != address(0), "GamePaymentGateway: bad bonding curve");
        bondingCurve = bondingCurve_;
        emit BondingCurveUpdated(bondingCurve_);
    }

    function setTreasury(address payable treasury_) external onlyOwner {
        require(treasury_ != address(0), "GamePaymentGateway: bad treasury");
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function isAcceptedToken(address token) public view returns (bool) {
        if (token == address(0) || token == labToken) return true;
        return IBondingCurveGraduation(bondingCurve).isGraduated(token);
    }

    /// @param token address(0) for native DOGE, otherwise an ERC20 (LAB or a
    /// graduated launcher token).
    /// @param amount required for ERC20 payments; ignored for native DOGE
    /// (msg.value is used instead).
    /// @param feature short tag identifying what's being paid for, e.g.
    /// "extra_life", "marketplace:<listingId>", "lab_surge:<matchId>".
    function pay(address token, uint256 amount, string calldata feature) external payable nonReentrant returns (uint256 paymentId) {
        require(bytes(feature).length > 0, "GamePaymentGateway: feature required");
        require(isAcceptedToken(token), "GamePaymentGateway: token not accepted");

        uint256 paidAmount;
        if (token == address(0)) {
            require(msg.value > 0, "GamePaymentGateway: send DOGE");
            paidAmount = msg.value;
            (bool ok, ) = treasury.call{value: paidAmount}("");
            require(ok, "GamePaymentGateway: DOGE forward failed");
        } else {
            require(msg.value == 0, "GamePaymentGateway: unexpected DOGE sent");
            require(amount > 0, "GamePaymentGateway: amount must be > 0");
            paidAmount = amount;
            require(IERC20(token).transferFrom(msg.sender, treasury, paidAmount), "GamePaymentGateway: token transfer failed");
        }

        paymentId = nextPaymentId++;
        emit PaymentReceived(paymentId, msg.sender, token, paidAmount, feature);
    }
}
