// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title LabFeedSocial
 * @notice On-chain Like and Comment interactions for DogeFood Lab's LabFeed.
 *
 * Every paid Like/Comment is a real transaction: the sender pays `likePrice`/
 * `commentPrice` in native DOGE, the contract splits it between the post's
 * author and the platform treasury, and emits an event the backend indexer
 * reconciles against its own database.
 *
 * Posts are registered lazily — there is no separate "publish on-chain" step
 * and no cost to the author just for posting. The first Like or Comment (or
 * an explicit `registerPost` call) on a given postId registers its author,
 * proven by a signature from a backend-controlled `registrarSigner`. The
 * contract never trusts a caller-supplied author address on its own — see
 * `_ensureRegistered`.
 *
 * Tipping is intentionally out of scope: DogeFood Lab's existing tip flow
 * (a direct wallet-to-wallet DOGE transfer, recorded off-chain) is untouched
 * by this contract.
 */
contract LabFeedSocial is Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_PLATFORM_FEE_BPS = 1_000; // 10% hard ceiling, admin can never exceed this

    address payable public treasury;
    address public registrarSigner;
    uint256 public likePrice;
    uint256 public commentPrice;
    uint256 public platformFeeBps;

    /// postId => author. address(0) means "not yet registered".
    mapping(bytes32 => address) public postAuthor;
    /// postId => liker => already paid to like this post.
    mapping(bytes32 => mapping(address => bool)) public hasLiked;
    /// postId => commentId => already recorded, guards against duplicate submission.
    mapping(bytes32 => mapping(bytes32 => bool)) public commentRecorded;

    event PostRegistered(bytes32 indexed postId, address indexed author);
    event PostLiked(
        bytes32 indexed postId,
        address indexed author,
        address indexed liker,
        uint256 creatorAmount,
        uint256 platformFee
    );
    event PostCommented(
        bytes32 indexed postId,
        bytes32 indexed commentId,
        address indexed author,
        address commenter,
        bytes32 commentHash,
        uint256 creatorAmount,
        uint256 platformFee
    );
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event RegistrarSignerUpdated(address indexed oldSigner, address indexed newSigner);
    event LikePriceUpdated(uint256 oldPrice, uint256 newPrice);
    event CommentPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event PlatformFeeUpdated(uint256 oldBps, uint256 newBps);

    constructor(
        address initialOwner,
        address payable initialTreasury,
        address initialRegistrarSigner,
        uint256 initialLikePrice,
        uint256 initialCommentPrice,
        uint256 initialPlatformFeeBps
    ) Ownable(initialOwner) {
        require(initialTreasury != address(0), "LabFeedSocial: treasury is zero");
        require(initialRegistrarSigner != address(0), "LabFeedSocial: signer is zero");
        require(initialPlatformFeeBps <= MAX_PLATFORM_FEE_BPS, "LabFeedSocial: fee too high");

        treasury = initialTreasury;
        registrarSigner = initialRegistrarSigner;
        likePrice = initialLikePrice;
        commentPrice = initialCommentPrice;
        platformFeeBps = initialPlatformFeeBps;
    }

    // ─── Interactions ──────────────────────────────────────────────────────

    function likePost(
        bytes32 postId,
        address author,
        bytes calldata registrationSig
    ) external payable nonReentrant whenNotPaused {
        address recordedAuthor = _ensureRegistered(postId, author, registrationSig);
        require(msg.sender != recordedAuthor, "LabFeedSocial: cannot like own post");
        require(!hasLiked[postId][msg.sender], "LabFeedSocial: already liked");
        require(msg.value == likePrice, "LabFeedSocial: incorrect payment");

        hasLiked[postId][msg.sender] = true;

        (uint256 creatorAmount, uint256 platformFee) = _splitPayment(msg.value);
        _payout(recordedAuthor, creatorAmount, platformFee);

        emit PostLiked(postId, recordedAuthor, msg.sender, creatorAmount, platformFee);
    }

    function commentPost(
        bytes32 postId,
        bytes32 commentId,
        bytes32 commentHash,
        address author,
        bytes calldata registrationSig
    ) external payable nonReentrant whenNotPaused {
        address recordedAuthor = _ensureRegistered(postId, author, registrationSig);
        require(!commentRecorded[postId][commentId], "LabFeedSocial: duplicate comment");
        require(msg.value == commentPrice, "LabFeedSocial: incorrect payment");

        commentRecorded[postId][commentId] = true;

        (uint256 creatorAmount, uint256 platformFee) = _splitPayment(msg.value);
        _payout(recordedAuthor, creatorAmount, platformFee);

        emit PostCommented(postId, commentId, recordedAuthor, msg.sender, commentHash, creatorAmount, platformFee);
    }

    /// @notice Explicit registration entry point, for callers who want a post
    /// bound on-chain ahead of its first Like/Comment. Not required — both
    /// likePost and commentPost register automatically on first use.
    function registerPost(bytes32 postId, address author, bytes calldata registrationSig) external {
        _ensureRegistered(postId, author, registrationSig);
    }

    // ─── Views ─────────────────────────────────────────────────────────────

    function isRegistered(bytes32 postId) external view returns (bool) {
        return postAuthor[postId] != address(0);
    }

    // ─── Internal ──────────────────────────────────────────────────────────

    function _ensureRegistered(
        bytes32 postId,
        address author,
        bytes calldata registrationSig
    ) internal returns (address) {
        address recorded = postAuthor[postId];
        if (recorded != address(0)) {
            return recorded;
        }

        require(author != address(0), "LabFeedSocial: bad author");
        bytes32 digest = keccak256(
            abi.encodePacked(postId, author, address(this), block.chainid)
        ).toEthSignedMessageHash();
        require(
            digest.recover(registrationSig) == registrarSigner,
            "LabFeedSocial: bad registration signature"
        );

        postAuthor[postId] = author;
        emit PostRegistered(postId, author);
        return author;
    }

    function _splitPayment(uint256 amount) internal view returns (uint256 creatorAmount, uint256 platformFee) {
        platformFee = (amount * platformFeeBps) / BPS_DENOMINATOR;
        creatorAmount = amount - platformFee;
    }

    function _payout(address author, uint256 creatorAmount, uint256 platformFee) internal {
        (bool authorOk, ) = payable(author).call{value: creatorAmount}("");
        require(authorOk, "LabFeedSocial: author payout failed");
        (bool treasuryOk, ) = treasury.call{value: platformFee}("");
        require(treasuryOk, "LabFeedSocial: treasury payout failed");
    }

    // ─── Admin ─────────────────────────────────────────────────────────────

    function setTreasury(address payable newTreasury) external onlyOwner {
        require(newTreasury != address(0), "LabFeedSocial: treasury is zero");
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function setRegistrarSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "LabFeedSocial: signer is zero");
        emit RegistrarSignerUpdated(registrarSigner, newSigner);
        registrarSigner = newSigner;
    }

    function setLikePrice(uint256 newPrice) external onlyOwner {
        emit LikePriceUpdated(likePrice, newPrice);
        likePrice = newPrice;
    }

    function setCommentPrice(uint256 newPrice) external onlyOwner {
        emit CommentPriceUpdated(commentPrice, newPrice);
        commentPrice = newPrice;
    }

    function setPlatformFeeBps(uint256 newBps) external onlyOwner {
        require(newBps <= MAX_PLATFORM_FEE_BPS, "LabFeedSocial: fee too high");
        emit PlatformFeeUpdated(platformFeeBps, newBps);
        platformFeeBps = newBps;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @dev Funds should only ever move through likePost/commentPost. Reject
    /// stray direct transfers rather than let them sit in the contract.
    receive() external payable {
        revert("LabFeedSocial: direct transfers not accepted");
    }
}
