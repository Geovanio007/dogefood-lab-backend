module.exports = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy, log } = deployments;
  const { deployer, admin } = await getNamedAccounts();

  log("🐕 Deploying DogeFood NFT Collection...");

  const dogeFood = await deploy("DogeFood", {
    from: deployer,
    args: [
      "DogeFood Collection",
      "DOGEFOOD",
      "https://metadata.dogeos.dev/dogefood/",
      admin
    ],
    log: true,
    waitConfirmations: network.live ? 3 : 1
  });

  log(`✅ DogeFood NFT deployed to: ${dogeFood.address}`);
  log(`🔗 View on DogeOS Explorer: https://blockscout.devnet.doge.xyz/address/${dogeFood.address}`);
  log(`📊 Max Supply: 420 NFTs`);
};

module.exports.tags = ["DogeFood"];