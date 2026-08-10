const { expect } = require("chai");
const { ethers } = require("hardhat");

const LIKE_PRICE = ethers.utils.parseEther("0.1");
const COMMENT_PRICE = ethers.utils.parseEther("0.5");
const PLATFORM_FEE_BPS = 10; // 0.1%

async function signRegistration(registrarWallet, contract, postId, author) {
  const network = await ethers.provider.getNetwork();
  const digest = ethers.utils.solidityKeccak256(
    ["bytes32", "address", "address", "uint256"],
    [postId, author, contract.address, network.chainId]
  );
  return registrarWallet.signMessage(ethers.utils.arrayify(digest));
}

function splitOf(amount, bps = PLATFORM_FEE_BPS) {
  const platformFee = amount.mul(bps).div(10000);
  const creatorAmount = amount.sub(platformFee);
  return { creatorAmount, platformFee };
}

// OpenZeppelin v5's Ownable/Pausable revert with custom errors, not string
// reasons, so waffle's `.revertedWith("...")` (string-reason matching only)
// can't see them. This checks the raw revert data starts with the error's
// 4-byte selector instead.
async function expectCustomError(txPromise, errorSignature) {
  const selector = ethers.utils.id(errorSignature).slice(0, 10);
  let threw = false;
  try {
    await txPromise;
  } catch (e) {
    threw = true;
    const data = String(e.data || "");
    expect(data.startsWith(selector), `expected revert data to start with ${selector} (${errorSignature}), got: ${data}`).to.equal(true);
  }
  expect(threw, `expected a revert (${errorSignature}) but the call succeeded`).to.equal(true);
}

describe("LabFeedSocial", function () {
  let owner, treasury, registrar, author, liker, liker2, stranger;
  let contract;

  beforeEach(async function () {
    [owner, treasury, registrar, author, liker, liker2, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("LabFeedSocial");
    contract = await Factory.deploy(
      owner.address,
      treasury.address,
      registrar.address,
      LIKE_PRICE,
      COMMENT_PRICE,
      PLATFORM_FEE_BPS
    );
    await contract.deployed();
  });

  describe("deployment", function () {
    it("sets constructor values", async function () {
      expect(await contract.owner()).to.equal(owner.address);
      expect(await contract.treasury()).to.equal(treasury.address);
      expect(await contract.registrarSigner()).to.equal(registrar.address);
      expect(await contract.likePrice()).to.equal(LIKE_PRICE);
      expect(await contract.commentPrice()).to.equal(COMMENT_PRICE);
      expect(await contract.platformFeeBps()).to.equal(PLATFORM_FEE_BPS);
    });

    it("rejects a zero treasury address", async function () {
      const Factory = await ethers.getContractFactory("LabFeedSocial");
      await expect(
        Factory.deploy(owner.address, ethers.constants.AddressZero, registrar.address, LIKE_PRICE, COMMENT_PRICE, PLATFORM_FEE_BPS)
      ).to.be.revertedWith("LabFeedSocial: treasury is zero");
    });

    it("rejects a zero registrar signer", async function () {
      const Factory = await ethers.getContractFactory("LabFeedSocial");
      await expect(
        Factory.deploy(owner.address, treasury.address, ethers.constants.AddressZero, LIKE_PRICE, COMMENT_PRICE, PLATFORM_FEE_BPS)
      ).to.be.revertedWith("LabFeedSocial: signer is zero");
    });

    it("rejects an initial platform fee above the hard ceiling", async function () {
      const Factory = await ethers.getContractFactory("LabFeedSocial");
      await expect(
        Factory.deploy(owner.address, treasury.address, registrar.address, LIKE_PRICE, COMMENT_PRICE, 1001)
      ).to.be.revertedWith("LabFeedSocial: fee too high");
    });
  });

  describe("likePost", function () {
    it("registers the post, splits payment correctly, and emits PostLiked", async function () {
      const postId = ethers.utils.id("post-1");
      const sig = await signRegistration(registrar, contract, postId, author.address);
      const { creatorAmount, platformFee } = splitOf(LIKE_PRICE);

      const tx = contract.connect(liker).likePost(postId, author.address, sig, { value: LIKE_PRICE });

      await expect(tx)
        .to.emit(contract, "PostRegistered").withArgs(postId, author.address)
        .and.to.emit(contract, "PostLiked").withArgs(postId, author.address, liker.address, creatorAmount, platformFee);

      await expect(() => tx).to.changeEtherBalances(
        [liker, author, treasury],
        [LIKE_PRICE.mul(-1), creatorAmount, platformFee]
      );

      expect(await contract.postAuthor(postId)).to.equal(author.address);
      expect(await contract.hasLiked(postId, liker.address)).to.equal(true);
    });

    it("does not require a signature once the post is already registered", async function () {
      const postId = ethers.utils.id("post-2");
      const sig = await signRegistration(registrar, contract, postId, author.address);
      await contract.connect(liker).likePost(postId, author.address, sig, { value: LIKE_PRICE });

      // second liker passes garbage bytes as the signature — should be ignored, not re-checked
      await expect(
        contract.connect(liker2).likePost(postId, author.address, "0x", { value: LIKE_PRICE })
      ).to.not.be.reverted;
      expect(await contract.hasLiked(postId, liker2.address)).to.equal(true);
    });

    it("rejects a bad registration signature", async function () {
      const postId = ethers.utils.id("post-3");
      const badSig = await signRegistration(stranger, contract, postId, author.address); // wrong signer
      await expect(
        contract.connect(liker).likePost(postId, author.address, badSig, { value: LIKE_PRICE })
      ).to.be.revertedWith("LabFeedSocial: bad registration signature");
    });

    it("rejects a signature bound to a different author", async function () {
      const postId = ethers.utils.id("post-3b");
      const sigForSomeoneElse = await signRegistration(registrar, contract, postId, stranger.address);
      await expect(
        contract.connect(liker).likePost(postId, author.address, sigForSomeoneElse, { value: LIKE_PRICE })
      ).to.be.revertedWith("LabFeedSocial: bad registration signature");
    });

    it("rejects the author liking their own post", async function () {
      const postId = ethers.utils.id("post-4");
      const sig = await signRegistration(registrar, contract, postId, author.address);
      await expect(
        contract.connect(author).likePost(postId, author.address, sig, { value: LIKE_PRICE })
      ).to.be.revertedWith("LabFeedSocial: cannot like own post");
    });

    it("rejects a duplicate like from the same wallet", async function () {
      const postId = ethers.utils.id("post-5");
      const sig = await signRegistration(registrar, contract, postId, author.address);
      await contract.connect(liker).likePost(postId, author.address, sig, { value: LIKE_PRICE });
      await expect(
        contract.connect(liker).likePost(postId, author.address, "0x", { value: LIKE_PRICE })
      ).to.be.revertedWith("LabFeedSocial: already liked");
    });

    it("rejects incorrect payment (too little)", async function () {
      const postId = ethers.utils.id("post-6");
      const sig = await signRegistration(registrar, contract, postId, author.address);
      await expect(
        contract.connect(liker).likePost(postId, author.address, sig, { value: LIKE_PRICE.sub(1) })
      ).to.be.revertedWith("LabFeedSocial: incorrect payment");
    });

    it("rejects incorrect payment (too much)", async function () {
      const postId = ethers.utils.id("post-7");
      const sig = await signRegistration(registrar, contract, postId, author.address);
      await expect(
        contract.connect(liker).likePost(postId, author.address, sig, { value: LIKE_PRICE.add(1) })
      ).to.be.revertedWith("LabFeedSocial: incorrect payment");
    });

    it("rejects an unregistered post with no signature at all", async function () {
      const postId = ethers.utils.id("post-8");
      await expect(
        contract.connect(liker).likePost(postId, author.address, "0x", { value: LIKE_PRICE })
      ).to.be.reverted; // ECDSA throws on a malformed/empty signature before the require even runs
    });

    it("reverts while paused", async function () {
      const postId = ethers.utils.id("post-9");
      const sig = await signRegistration(registrar, contract, postId, author.address);
      await contract.connect(owner).pause();
      await expectCustomError(
        contract.connect(liker).likePost(postId, author.address, sig, { value: LIKE_PRICE }),
        "EnforcedPause()"
      );
    });
  });

  describe("commentPost", function () {
    it("splits payment correctly and emits PostCommented with the hash", async function () {
      const postId = ethers.utils.id("post-c1");
      const commentId = ethers.utils.id("comment-1");
      const commentHash = ethers.utils.id("hello world");
      const sig = await signRegistration(registrar, contract, postId, author.address);
      const { creatorAmount, platformFee } = splitOf(COMMENT_PRICE);

      const tx = contract.connect(liker).commentPost(postId, commentId, commentHash, author.address, sig, { value: COMMENT_PRICE });

      await expect(tx)
        .to.emit(contract, "PostCommented")
        .withArgs(postId, commentId, author.address, liker.address, commentHash, creatorAmount, platformFee);

      await expect(() => tx).to.changeEtherBalances(
        [liker, author, treasury],
        [COMMENT_PRICE.mul(-1), creatorAmount, platformFee]
      );
    });

    it("allows an author to comment on their own post", async function () {
      const postId = ethers.utils.id("post-c2");
      const commentId = ethers.utils.id("comment-2");
      const sig = await signRegistration(registrar, contract, postId, author.address);
      await expect(
        contract.connect(author).commentPost(postId, commentId, ethers.utils.id("hi"), author.address, sig, { value: COMMENT_PRICE })
      ).to.not.be.reverted;
    });

    it("rejects a duplicate commentId", async function () {
      const postId = ethers.utils.id("post-c3");
      const commentId = ethers.utils.id("comment-3");
      const sig = await signRegistration(registrar, contract, postId, author.address);
      await contract.connect(liker).commentPost(postId, commentId, ethers.utils.id("a"), author.address, sig, { value: COMMENT_PRICE });
      await expect(
        contract.connect(liker2).commentPost(postId, commentId, ethers.utils.id("b"), author.address, "0x", { value: COMMENT_PRICE })
      ).to.be.revertedWith("LabFeedSocial: duplicate comment");
    });

    it("rejects incorrect payment", async function () {
      const postId = ethers.utils.id("post-c4");
      const sig = await signRegistration(registrar, contract, postId, author.address);
      await expect(
        contract.connect(liker).commentPost(postId, ethers.utils.id("c"), ethers.utils.id("x"), author.address, sig, { value: COMMENT_PRICE.sub(1) })
      ).to.be.revertedWith("LabFeedSocial: incorrect payment");
    });

    it("rejects an invalid/unregistered post", async function () {
      const postId = ethers.utils.id("post-c5");
      await expect(
        contract.connect(liker).commentPost(postId, ethers.utils.id("c"), ethers.utils.id("x"), author.address, "0x", { value: COMMENT_PRICE })
      ).to.be.reverted;
    });

    it("reverts while paused", async function () {
      const postId = ethers.utils.id("post-c6");
      const sig = await signRegistration(registrar, contract, postId, author.address);
      await contract.connect(owner).pause();
      await expectCustomError(
        contract.connect(liker).commentPost(postId, ethers.utils.id("c"), ethers.utils.id("x"), author.address, sig, { value: COMMENT_PRICE }),
        "EnforcedPause()"
      );
    });
  });

  describe("registerPost", function () {
    it("registers a post ahead of any like/comment", async function () {
      const postId = ethers.utils.id("post-r1");
      const sig = await signRegistration(registrar, contract, postId, author.address);
      await expect(contract.registerPost(postId, author.address, sig))
        .to.emit(contract, "PostRegistered").withArgs(postId, author.address);
      expect(await contract.isRegistered(postId)).to.equal(true);
    });

    it("is a no-op (does not re-check the signature or revert) if already registered", async function () {
      const postId = ethers.utils.id("post-r2");
      const sig = await signRegistration(registrar, contract, postId, author.address);
      await contract.registerPost(postId, author.address, sig);
      await expect(contract.registerPost(postId, stranger.address, "0x")).to.not.be.reverted;
      expect(await contract.postAuthor(postId)).to.equal(author.address); // unchanged
    });
  });

  describe("reentrancy protection", function () {
    it("blocks a malicious author from re-entering likePost during payout", async function () {
      const Malicious = await ethers.getContractFactory("MaliciousReentrant");
      const malicious = await Malicious.deploy(contract.address);
      await malicious.deployed();

      // A second, already-registered post the malicious contract will try to
      // like mid-payout.
      const victimPostId = ethers.utils.id("victim-post");
      const victimSig = await signRegistration(registrar, contract, victimPostId, stranger.address);
      await contract.connect(liker2).likePost(victimPostId, stranger.address, victimSig, { value: LIKE_PRICE });
      await malicious.arm(victimPostId, stranger.address, false);

      // Register the malicious contract itself as the author of the post
      // being liked, so it receives the creator payout and its receive()
      // hook fires.
      const attackPostId = ethers.utils.id("attack-post");
      const attackSig = await signRegistration(registrar, contract, attackPostId, malicious.address);

      await expect(
        contract.connect(liker).likePost(attackPostId, malicious.address, attackSig, { value: LIKE_PRICE })
      ).to.be.revertedWith("LabFeedSocial: author payout failed");
      // ^ the nested call reverts with ReentrancyGuard's own message, which
      // _payout's low-level .call() swallows into a bool; the outer likePost
      // then reverts with this message instead. Either way, the post is
      // never marked liked and no funds move.
      expect(await contract.hasLiked(attackPostId, liker.address)).to.equal(false);
    });
  });

  describe("admin controls", function () {
    it("only the owner can update treasury, signer, prices, and fee", async function () {
      await expectCustomError(contract.connect(stranger).setTreasury(stranger.address), "OwnableUnauthorizedAccount(address)");
      await expectCustomError(contract.connect(stranger).setRegistrarSigner(stranger.address), "OwnableUnauthorizedAccount(address)");
      await expectCustomError(contract.connect(stranger).setLikePrice(1), "OwnableUnauthorizedAccount(address)");
      await expectCustomError(contract.connect(stranger).setCommentPrice(1), "OwnableUnauthorizedAccount(address)");
      await expectCustomError(contract.connect(stranger).setPlatformFeeBps(1), "OwnableUnauthorizedAccount(address)");
      await expectCustomError(contract.connect(stranger).pause(), "OwnableUnauthorizedAccount(address)");
    });

    it("lets the owner update treasury and emits TreasuryUpdated", async function () {
      await expect(contract.connect(owner).setTreasury(stranger.address))
        .to.emit(contract, "TreasuryUpdated").withArgs(treasury.address, stranger.address);
      expect(await contract.treasury()).to.equal(stranger.address);
    });

    it("rejects a zero treasury on update", async function () {
      await expect(contract.connect(owner).setTreasury(ethers.constants.AddressZero)).to.be.revertedWith("LabFeedSocial: treasury is zero");
    });

    it("caps platformFeeBps at the hard ceiling regardless of owner input", async function () {
      await expect(contract.connect(owner).setPlatformFeeBps(1001)).to.be.revertedWith("LabFeedSocial: fee too high");
      await expect(contract.connect(owner).setPlatformFeeBps(1000)).to.not.be.reverted;
    });

    it("pause blocks interactions and unpause restores them", async function () {
      const postId = ethers.utils.id("post-pause");
      const sig = await signRegistration(registrar, contract, postId, author.address);
      await contract.connect(owner).pause();
      await expectCustomError(
        contract.connect(liker).likePost(postId, author.address, sig, { value: LIKE_PRICE }),
        "EnforcedPause()"
      );
      await contract.connect(owner).unpause();
      await expect(
        contract.connect(liker).likePost(postId, author.address, sig, { value: LIKE_PRICE })
      ).to.not.be.reverted;
    });

    it("rejects stray direct transfers", async function () {
      await expect(
        liker.sendTransaction({ to: contract.address, value: ethers.utils.parseEther("1") })
      ).to.be.revertedWith("LabFeedSocial: direct transfers not accepted");
    });
  });
});
