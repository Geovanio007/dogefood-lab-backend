// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IDexRouter {
    function factory() external view returns (address);
    function WETH() external view returns (address);
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);
}

interface IDexFactory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface ILaunchTokenGraduation {
    function activateSwapFee(address pair) external;
}

/**
 * @title GraduationManager
 * @dev Receives a token's remaining supply and raised DOGE from BondingCurve
 * once it hits its target, and turns that into a permanently locked DEX
 * position: it adds the liquidity, burns the LP tokens to a dead address
 * (the simplest, most trustless form of "Liquidity Locked" - nobody, not
 * even DogeFood Lab, can ever be the one who pulls it), and flips on the
 * token's post-graduation swap fee against the new pair.
 *
 * The DEX router address is NOT hardcoded - DogeOS's router/factory
 * addresses should be set via setRouter() once known. graduate() reverts
 * until that's configured, so a missing router blocks graduation loudly
 * instead of silently sending funds somewhere wrong.
 */
contract GraduationManager is Ownable {
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    address public bondingCurve;
    IDexRouter public router;

    /// @dev Basis points of slippage tolerance allowed when seeding the pool
    /// (e.g. 300 = 3%). Applies to both the token and DOGE side.
    uint256 public liquiditySlippageBps = 300;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    mapping(address => address) public pairOf; // launched token => DEX pair

    event RouterUpdated(address indexed router);
    event BondingCurveUpdated(address indexed bondingCurve);
    event TokenGraduated(address indexed token, address indexed pair, address creator, uint256 dogeAmount, uint256 tokenAmount, uint256 liquidity);

    modifier onlyBondingCurve() {
        require(msg.sender == bondingCurve, "GraduationManager: not bonding curve");
        _;
    }

    constructor(address bondingCurve_, address owner_) Ownable(owner_) {
        require(bondingCurve_ != address(0), "GraduationManager: bad bonding curve");
        bondingCurve = bondingCurve_;
    }

    function setBondingCurve(address bondingCurve_) external onlyOwner {
        require(bondingCurve_ != address(0), "GraduationManager: bad bonding curve");
        bondingCurve = bondingCurve_;
        emit BondingCurveUpdated(bondingCurve_);
    }

    /// @dev Must be called with DogeOS's live DEX router address before the
    /// first token can graduate.
    function setRouter(address router_) external onlyOwner {
        require(router_ != address(0), "GraduationManager: bad router");
        router = IDexRouter(router_);
        emit RouterUpdated(router_);
    }

    function setLiquiditySlippageBps(uint256 bps) external onlyOwner {
        require(bps <= 2_000, "GraduationManager: slippage too high"); // hard cap at 20%
        liquiditySlippageBps = bps;
    }

    /// @dev Called once by BondingCurve when a curve's graduation target is
    /// reached. Expects tokenAmount of `token` to already have been
    /// transferred here, and the DOGE amount to arrive as msg.value.
    function graduate(address token, uint256 tokenAmount, address creator) external payable onlyBondingCurve {
        require(address(router) != address(0), "GraduationManager: router not configured");
        require(msg.value > 0 && tokenAmount > 0, "GraduationManager: nothing to seed pool with");
        require(pairOf[token] == address(0), "GraduationManager: already graduated");

        uint256 tokenMin = tokenAmount - ((tokenAmount * liquiditySlippageBps) / BPS_DENOMINATOR);
        uint256 dogeMin = msg.value - ((msg.value * liquiditySlippageBps) / BPS_DENOMINATOR);

        require(IERC20(token).approve(address(router), tokenAmount), "GraduationManager: approve failed");

        (, , uint256 liquidity) = router.addLiquidityETH{value: msg.value}(
            token,
            tokenAmount,
            tokenMin,
            dogeMin,
            BURN_ADDRESS,
            block.timestamp + 15 minutes
        );

        address pair = IDexFactory(router.factory()).getPair(token, router.WETH());
        require(pair != address(0), "GraduationManager: pair not found");
        pairOf[token] = pair;

        ILaunchTokenGraduation(token).activateSwapFee(pair);

        emit TokenGraduated(token, pair, creator, msg.value, tokenAmount, liquidity);

        // Any dust left over from addLiquidityETH's min-amount rounding stays
        // in this contract; sweep() lets the owner recover it.
    }

    /// @dev Recovers rounding dust left behind after addLiquidityETH (it can
    /// use slightly less than the full amounts offered). Does not touch
    /// tokens/DOGE mid-graduation since graduate() is a single atomic call.
    function sweep(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "GraduationManager: bad recipient");
        if (token == address(0)) {
            (bool ok, ) = payable(to).call{value: amount}("");
            require(ok, "GraduationManager: DOGE sweep failed");
        } else {
            require(IERC20(token).transfer(to, amount), "GraduationManager: token sweep failed");
        }
    }

    receive() external payable {}
}
