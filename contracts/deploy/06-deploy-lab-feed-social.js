module.exports = async ({ getNamedAccounts, deployments, network, ethers }) => {
  const { deploy, log, get } = deployments;
  const { deployer, admin } = await getNamedAccounts();

  // LauncherTreasury is deployed as part of the "LabLauncher" tag (see
  // 05-deploy-lab-launcher.js) — it already collects bonding-curve and
  // game-payment fees, so the new 0.1% Like/Comment platform fee goes there
  // too rather than standing up a second treasury.
  const launcherTreasury = await get("LauncherTreasury");

  // registrarSigner is a NEW, dedicated key — deliberately NOT the admin
  // key. The backend holds its private key and uses it only to sign
  // "this postId belongs to this author" attestations (see
  // LabFeedSocial._ensureRegistered); it never spends funds or holds any
  // other privilege. Keeping it separate from admin means a compromised
  // backend signing key can at worst mis-register a not-yet-registered
  // post, not touch treasury/fees/pause/ownership.
  let registrarSigner = process.env.REGISTRAR_SIGNER_ADDRESS;
  if (!registrarSigner) {
    if (network.live) {
      throw new Error(
        "REGISTRAR_SIGNER_ADDRESS is not set. LabFeedSocial needs its own signer " +
        "key, generated and held by the backend — do not reuse the admin/deployer " +
        "key for this. Set REGISTRAR_SIGNER_ADDRESS to that key's public address " +
        "and re-run."
      );
    }
    log("⚠️  REGISTRAR_SIGNER_ADDRESS not set — using admin as a local-only fallback.");
    registrarSigner = admin;
  }

  const likePrice = ethers.utils.parseEther(process.env.LABFEED_LIKE_PRICE_DOGE || "0.1");
  const commentPrice = ethers.utils.parseEther(process.env.LABFEED_COMMENT_PRICE_DOGE || "0.5");
  const platformFeeBps = Number(process.env.LABFEED_PLATFORM_FEE_BPS || 10); // 10 bps = 0.1%

  log("❤️ Deploying LabFeedSocial...");
  const labFeedSocial = await deploy("LabFeedSocial", {
    from: deployer,
    args: [
      admin,                      // initialOwner
      launcherTreasury.address,   // initialTreasury
      registrarSigner,            // initialRegistrarSigner
      likePrice,                  // initialLikePrice
      commentPrice,                // initialCommentPrice
      platformFeeBps,              // initialPlatformFeeBps
    ],
    log: true,
    waitConfirmations: network.live ? 3 : 1,
  });
  log(`✅ LabFeedSocial deployed to: ${labFeedSocial.address}`);
  log(`   treasury: ${launcherTreasury.address}`);
  log(`   registrarSigner: ${registrarSigner}`);
  log(`   likePrice: ${ethers.utils.formatEther(likePrice)} DOGE, commentPrice: ${ethers.utils.formatEther(commentPrice)} DOGE, platformFeeBps: ${platformFeeBps}`);
};

module.exports.tags = ["LabFeedSocial"];
module.exports.dependencies = ["LabLauncher"];
