module.exports = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy, log } = deployments;
  const { deployer, admin } = await getNamedAccounts();

  log("🚀 Deploying LAB Token...");

  const labToken = await deploy("LABToken", {
    from: deployer,
    args: [
      admin, // owner
      "0x0000000000000000000000000000000000000000", // rewardDistributor - to be updated later
      admin, // publicSale
      admin, // liquidity
      admin, // marketing
      admin  // teamVesting
    ],
    log: true,
    waitConfirmations: network.live ? 3 : 1
  });

  log(`✅ LAB Token deployed to: ${labToken.address}`);
  log(`🔗 View on DogeOS Explorer: https://blockscout.devnet.doge.xyz/address/${labToken.address}`);
};

module.exports.tags = ["LABToken"];