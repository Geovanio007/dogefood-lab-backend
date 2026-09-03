module.exports = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy, log } = deployments;
  const { deployer, admin } = await getNamedAccounts();

  // registrarSigner is a NEW, dedicated key for this campaign — same
  // reasoning as LabFeedSocial's REGISTRAR_SIGNER_ADDRESS (see
  // 06-deploy-lab-feed-social.js and services/dogeos_medal_signer.py):
  // deliberately NOT the admin key, NOT the LabFeedSocial registrar key
  // either. The backend holds its private key and uses it only to sign
  // "this wallet created a Lab Launcher token" attestations for
  // claimMedal() — it never spends funds or touches contract config, so a
  // compromised backend key can at worst let someone claim a medal, not
  // touch anything else.
  let registrarSigner = process.env.HEIST_MEDAL_REGISTRAR_SIGNER_ADDRESS;
  if (!registrarSigner) {
    if (network.live) {
      throw new Error(
        "HEIST_MEDAL_REGISTRAR_SIGNER_ADDRESS is not set. HeistMedal needs its own " +
        "signer key, generated and held by the backend — do not reuse the admin/deployer " +
        "or LabFeedSocial registrar key for this. Set HEIST_MEDAL_REGISTRAR_SIGNER_ADDRESS " +
        "to that key's public address and re-run."
      );
    }
    log("⚠️  HEIST_MEDAL_REGISTRAR_SIGNER_ADDRESS not set — using admin as a local-only fallback.");
    registrarSigner = admin;
  }

  // Bruno's medal artwork isn't uploaded to IPFS yet — this placeholder
  // makes that obvious in the deployment record rather than silently
  // deploying with a broken URI. Owner can fix it later via
  // setMetadataURI() without redeploying, but for a real network deploy
  // this should be set correctly up front.
  const metadataURI = process.env.HEIST_MEDAL_METADATA_URI;
  if (!metadataURI) {
    if (network.live) {
      throw new Error(
        "HEIST_MEDAL_METADATA_URI is not set. Pin the medal's metadata JSON (pointing at " +
        "the medal image) to IPFS first, then set this to that ipfs:// URI and re-run."
      );
    }
    log("⚠️  HEIST_MEDAL_METADATA_URI not set — using a placeholder for local-only deploy.");
  }

  log("🏅 Deploying HeistMedal...");
  const heistMedal = await deploy("HeistMedal", {
    from: deployer,
    args: [
      admin,                                                    // initialOwner
      registrarSigner,                                          // initialRegistrarSigner
      metadataURI || "ipfs://REPLACE_ME/heist-medal-metadata.json", // initialMetadataURI
    ],
    log: true,
    waitConfirmations: network.live ? 3 : 1,
  });
  log(`✅ HeistMedal deployed to: ${heistMedal.address}`);
  log(`   registrarSigner: ${registrarSigner}`);
  log(`   metadataURI: ${metadataURI || "(placeholder — set the real one before going live)"}`);
  log(`   Set backend env HEIST_MEDAL_CONTRACT_ADDRESS=${heistMedal.address} once deployed.`);
};

module.exports.tags = ["HeistMedal"];
