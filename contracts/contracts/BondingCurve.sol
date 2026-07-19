// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IGraduationManager {
    function graduate(address token, uint256 tokenAmount, address creator) external payable;
}

/**
 * @title BondingCurve
 * @dev Single contract that prices, buys, and sells every Lab Launcher
 * token against native DOGE, using a constant-product curve with virtual
 * reserves (the same style pump.fun-style launchpads use): price starts low
 * and rises smoothly as more DOGE is raised, without needing an initial
 * liquidity deposit from the creator. Each token gets its own Curve entry
 * rather than its own contract, which keeps per-launch deployment cheap -
 * LaunchpadFactory only has to deploy the token itself.
 *
 * Every trade pays a 2% fee to LauncherTreasury. Once a curve's real DOGE
 * reserve reaches its graduation target, the remaining token and DOGE
 * balances are handed to GraduationManager to seed a locked DEX pool and
 * further bonding-curve trading on that token is disabled.
 */
contract BondingCurve is Ownable, ReentrancyGuard {
    uint256 public constant FEE_BPS = 200; // 2% on every buy/sell
    uint256 public constant BPS_DENOMINATOR = 10_000;

    struct Curve {
        address creator;
        uint256 virtualDoge;
        uint256 virtualToken;
        uint256 realDogeReserve;
        uint256 realTokenReserve;
        uint256 graduationTarget;
        bool graduated;
        bool exists;
    }

    mapping(address => Curve) public curves;

    address public factory;
    address public graduationManager;
    address payable public treasury;

    // Defaults applied to newly registered curves. Tuned so that hitting the
    // default 100,000 DOGE graduation target (the example raise size from the
    // Lab Launcher spec) leaves a sensible remainder to seed the DEX pool -
    // review and retune these once real trading data / target price is known.
    uint256 public defaultVirtualDoge = 30_000 ether;
    uint256 public defaultVirtualToken = 1_073_000_000 ether;
    uint256 public defaultGraduationTarget = 100_000 ether;

    event FactoryUpdated(address indexed factory);
    event GraduationManagerUpdated(address indexed graduationManager);
    event CurveDefaultsUpdated(uint256 virtualDoge, uint256 virtualToken, uint256 graduationTarget);
    event TokenRegistered(address indexed token, address indexed creator, uint256 initialSupply, uint256 graduationTarget);
    event Trade(address indexed token, address indexed trader, bool isBuy, uint256 dogeAmount, uint256 tokenAmount, uint256 fee);
    event GraduationTriggered(address indexed token, uint256 dogeAmount, uint256 tokenAmount);

    modifier onlyFactory() {
        require(msg.sender == factory, "BondingCurve: not factory");
        _;
    }

    modifier curveExists(address token) {
        require(curves[token].exists, "BondingCurve: unknown token");
        _;
    }

    constructor(address payable treasury_, address owner_) Ownable(owner_) {
        require(treasury_ != address(0), "BondingCurve: bad treasury");
        treasury = treasury_;
    }

    // --- admin / wiring -----------------------------------------------

    function setFactory(address factory_) external onlyOwner {
        require(factory_ != address(0), "BondingCurve: bad factory");
        factory = factory_;
        emit FactoryUpdated(factory_);
    }

    function setGraduationManager(address graduationManager_) external onlyOwner {
        require(graduationManager_ != address(0), "BondingCurve: bad graduation manager");
        graduationManager = graduationManager_;
        emit GraduationManagerUpdated(graduationManager_);
    }

    /// @dev Only affects curves registered AFTER this call - already-launched
    /// tokens keep the parameters they were registered with.
    function setCurveDefaults(uint256 virtualDoge_, uint256 virtualToken_, uint256 graduationTarget_) external onlyOwner {
        require(virtualDoge_ > 0 && virtualToken_ > 0 && graduationTarget_ > 0, "BondingCurve: bad params");
        defaultVirtualDoge = virtualDoge_;
        defaultVirtualToken = virtualToken_;
        defaultGraduationTarget = graduationTarget_;
        emit CurveDefaultsUpdated(virtualDoge_, virtualToken_, graduationTarget_);
    }

    // --- factory entry point --------------------------------------------

    /// @dev Called once by LaunchpadFactory immediately after it mints a new
    /// token's full supply to this contract.
    function registerToken(address token, address creator_) external onlyFactory {
        require(token != address(0), "BondingCurve: bad token");
        require(creator_ != address(0), "BondingCurve: bad creator");
        require(!curves[token].exists, "BondingCurve: already registered");

        uint256 initialSupply = IERC20(token).balanceOf(address(this));
        require(initialSupply > 0, "BondingCurve: no supply held");

        curves[token] = Curve({
            creator: creator_,
            virtualDoge: defaultVirtualDoge,
            virtualToken: defaultVirtualToken,
            realDogeReserve: 0,
            realTokenReserve: initialSupply,
            graduationTarget: defaultGraduationTarget,
            graduated: false,
            exists: true
        });

        emit TokenRegistered(token, creator_, initialSupply, defaultGraduationTarget);
    }

    // --- trading ----------------------------------------------------------

    function buy(address token, uint256 minTokensOut) external payable nonReentrant curveExists(token) {
        Curve storage curve = curves[token];
        require(!curve.graduated, "BondingCurve: graduated, trade on the DEX");
        require(msg.value > 0, "BondingCurve: send DOGE to buy");

        uint256 fee = (msg.value * FEE_BPS) / BPS_DENOMINATOR;
        uint256 netIn = msg.value - fee;

        uint256 tokensOut = _getAmountOut(netIn, curve.virtualDoge, curve.virtualToken);
        require(tokensOut >= minTokensOut, "BondingCurve: slippage");
        require(tokensOut <= curve.realTokenReserve, "BondingCurve: not enough left on curve");

        curve.virtualDoge += netIn;
        curve.virtualToken -= tokensOut;
        curve.realDogeReserve += netIn;
        curve.realTokenReserve -= tokensOut;

        require(IERC20(token).transfer(msg.sender, tokensOut), "BondingCurve: token transfer failed");

        if (fee > 0) {
            (bool ok, ) = treasury.call{value: fee}("");
            require(ok, "BondingCurve: fee transfer failed");
        }

        emit Trade(token, msg.sender, true, msg.value, tokensOut, fee);

        if (curve.realDogeReserve >= curve.graduationTarget) {
            _graduate(token, curve);
        }
    }

    function sell(address token, uint256 tokenAmount, uint256 minDogeOut) external nonReentrant curveExists(token) {
        Curve storage curve = curves[token];
        require(!curve.graduated, "BondingCurve: graduated, trade on the DEX");
        require(tokenAmount > 0, "BondingCurve: amount must be > 0");

        uint256 dogeOutGross = _getAmountOut(tokenAmount, curve.virtualToken, curve.virtualDoge);
        require(dogeOutGross <= curve.realDogeReserve, "BondingCurve: not enough liquidity");

        uint256 fee = (dogeOutGross * FEE_BPS) / BPS_DENOMINATOR;
        uint256 dogeOutNet = dogeOutGross - fee;
        require(dogeOutNet >= minDogeOut, "BondingCurve: slippage");

        curve.virtualToken += tokenAmount;
        curve.virtualDoge -= dogeOutGross;
        curve.realTokenReserve += tokenAmount;
        curve.realDogeReserve -= dogeOutGross;

        require(IERC20(token).transferFrom(msg.sender, address(this), tokenAmount), "BondingCurve: token transfer failed");

        (bool ok, ) = payable(msg.sender).call{value: dogeOutNet}("");
        require(ok, "BondingCurve: DOGE transfer failed");

        if (fee > 0) {
            (bool feeOk, ) = treasury.call{value: fee}("");
            require(feeOk, "BondingCurve: fee transfer failed");
        }

        emit Trade(token, msg.sender, false, dogeOutGross, tokenAmount, fee);
    }

    function _graduate(address token, Curve storage curve) internal {
        require(graduationManager != address(0), "BondingCurve: graduation manager not set");

        curve.graduated = true;

        uint256 dogeAmount = curve.realDogeReserve;
        uint256 tokenAmount = curve.realTokenReserve;
        curve.realDogeReserve = 0;
        curve.realTokenReserve = 0;

        require(IERC20(token).transfer(graduationManager, tokenAmount), "BondingCurve: handoff transfer failed");
        IGraduationManager(graduationManager).graduate{value: dogeAmount}(token, tokenAmount, curve.creator);

        emit GraduationTriggered(token, dogeAmount, tokenAmount);
    }

    // --- views used by the frontend / backend ------------------------------

    function isGraduated(address token) external view returns (bool) {
        return curves[token].graduated;
    }

    function getCurrentPrice(address token) external view curveExists(token) returns (uint256) {
        Curve storage curve = curves[token];
        return (curve.virtualDoge * 1e18) / curve.virtualToken;
    }

    function getBondingProgressBps(address token) external view curveExists(token) returns (uint256) {
        Curve storage curve = curves[token];
        if (curve.graduated) return BPS_DENOMINATOR;
        uint256 progress = (curve.realDogeReserve * BPS_DENOMINATOR) / curve.graduationTarget;
        return progress > BPS_DENOMINATOR ? BPS_DENOMINATOR : progress;
    }

    function previewBuy(address token, uint256 dogeIn) external view curveExists(token) returns (uint256 tokensOut, uint256 fee) {
        Curve storage curve = curves[token];
        fee = (dogeIn * FEE_BPS) / BPS_DENOMINATOR;
        tokensOut = _getAmountOut(dogeIn - fee, curve.virtualDoge, curve.virtualToken);
    }

    function previewSell(address token, uint256 tokenIn) external view curveExists(token) returns (uint256 dogeOut, uint256 fee) {
        Curve storage curve = curves[token];
        uint256 gross = _getAmountOut(tokenIn, curve.virtualToken, curve.virtualDoge);
        fee = (gross * FEE_BPS) / BPS_DENOMINATOR;
        dogeOut = gross - fee;
    }

    function _getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256) {
        return (amountIn * reserveOut) / (reserveIn + amountIn);
    }
}
