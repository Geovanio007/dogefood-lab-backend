// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title HeistMedal
/// @notice Campaign-limited ERC-1155 medal for the DogeOS "Grand Heist"
/// questline's Lab Launcher sidequest. One medal per wallet, self-minted -
/// same "backend signs an off-chain attestation, user submits it and pays
/// gas themselves" pattern already proven in LabFeedSocial.sol's
/// registerPost/_ensureRegistered.
///
/// Every medal shares the same artwork/metadata (see `setMetadataURI`), but
/// per Bruno's spec each claim gets its own unique token ID rather than all
/// holders sharing one ID - `uri()` deliberately ignores the id argument
/// and always returns the same URI.
///
/// The backend (registrarSigner) is the sole judge of *eligibility*
/// (created a token via Lab Launcher) - this contract only verifies that
/// signature and enforces one-per-wallet + the campaign on/off switch. It
/// never talks to LaunchpadFactory or lab_launcher_tokens directly, keeping
/// this contract simple and this campaign's logic isolated from the
/// permanent Lab Launcher contracts.
contract HeistMedal is ERC1155, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    /// @dev Baked into the signed digest so this signer key could never be
    /// replayed against a *different* signature-gated contract that reused
    /// the same registrar key for something else.
    bytes32 public constant CAMPAIGN_ID = keccak256("DOGEOS_GRAND_HEIST_2026_MEDAL");

    address public registrarSigner;
    bool public campaignOpen = true;
    string private _metadataURI;

    uint256 private _nextTokenId = 1;
    mapping(address => bool) public hasClaimed;
    mapping(uint256 => address) public claimedBy;

    event MedalClaimed(address indexed claimer, uint256 indexed tokenId);
    event CampaignStatusChanged(bool open);
    event RegistrarSignerChanged(address indexed newSigner);
    event MetadataURIChanged(string newURI);

    constructor(address initialOwner, address initialRegistrarSigner, string memory initialMetadataURI)
        ERC1155(initialMetadataURI)
        Ownable(initialOwner)
    {
        require(initialRegistrarSigner != address(0), "HeistMedal: zero signer");
        registrarSigner = initialRegistrarSigner;
        _metadataURI = initialMetadataURI;
    }

    /// @notice Claim your medal. Callable once per wallet, only while the
    /// campaign is open, only with a valid attestation from the backend.
    /// @param signature Signed by registrarSigner over
    ///   keccak256(abi.encodePacked(msg.sender, CAMPAIGN_ID, address(this), block.chainid))
    ///   as an EIP-191 personal-sign message. This digest has no
    ///   expiry/nonce by design - it's naturally idempotent (the backend
    ///   can hand out the same signature to the same wallet every time it's
    ///   asked), and hasClaimed below is what actually prevents reuse.
    function claimMedal(bytes calldata signature) external nonReentrant returns (uint256 tokenId) {
        require(campaignOpen, "HeistMedal: campaign closed");
        require(!hasClaimed[msg.sender], "HeistMedal: already claimed");

        bytes32 digest = keccak256(abi.encodePacked(msg.sender, CAMPAIGN_ID, address(this), block.chainid))
            .toEthSignedMessageHash();
        require(digest.recover(signature) == registrarSigner, "HeistMedal: invalid signature");

        hasClaimed[msg.sender] = true;
        tokenId = _nextTokenId++;
        claimedBy[tokenId] = msg.sender;

        _mint(msg.sender, tokenId, 1, "");
        emit MedalClaimed(msg.sender, tokenId);
    }

    /// @notice Every token ID shares the same artwork/metadata - the `id`
    /// argument is intentionally ignored.
    function uri(uint256) public view override returns (string memory) {
        return _metadataURI;
    }

    function totalClaimed() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    // --- Admin controls -----------------------------------------------

    /// @notice The permanent on/off switch: once false, claimMedal always
    /// reverts, even with an otherwise-valid signature. This is the
    /// on-chain half of shutting the campaign down - see
    /// dogeos_medal_routes.py's admin/close-campaign endpoint, which flips
    /// this (best-effort) in the same call that stops the backend from
    /// issuing new signatures.
    function setCampaignOpen(bool open_) external onlyOwner {
        campaignOpen = open_;
        emit CampaignStatusChanged(open_);
    }

    function setRegistrarSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "HeistMedal: zero signer");
        registrarSigner = newSigner;
        emit RegistrarSignerChanged(newSigner);
    }

    function setMetadataURI(string calldata newURI) external onlyOwner {
        _metadataURI = newURI;
        emit MetadataURIChanged(newURI);
    }
}
