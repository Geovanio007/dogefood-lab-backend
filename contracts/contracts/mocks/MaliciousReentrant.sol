// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @dev Test-only helper. Not deployed to any real network.
 * Poses as a post author; when it receives its creator payout it tries to
 * immediately call back into LabFeedSocial, to prove the ReentrancyGuard on
 * likePost/commentPost actually blocks nested calls.
 */
interface ILabFeedSocialForTest {
    function likePost(bytes32 postId, address author, bytes calldata registrationSig) external payable;
    function commentPost(
        bytes32 postId,
        bytes32 commentId,
        bytes32 commentHash,
        address author,
        bytes calldata registrationSig
    ) external payable;
}

contract MaliciousReentrant {
    ILabFeedSocialForTest public target;
    bytes32 public reentryPostId;
    address public reentryAuthor;
    bool public reentryOnComment;

    constructor(address _target) {
        target = ILabFeedSocialForTest(_target);
    }

    /// @dev Configures what the receive() hook will try to call back into.
    function arm(bytes32 _postId, address _author, bool _onComment) external {
        reentryPostId = _postId;
        reentryAuthor = _author;
        reentryOnComment = _onComment;
    }

    function likeAsAuthor(
        bytes32 postId,
        address author,
        bytes calldata registrationSig
    ) external payable {
        target.likePost{value: msg.value}(postId, author, registrationSig);
    }

    receive() external payable {
        if (reentryOnComment) {
            target.commentPost(reentryPostId, keccak256("reentrant"), keccak256("x"), reentryAuthor, "");
        } else {
            target.likePost(reentryPostId, reentryAuthor, "");
        }
    }
}
