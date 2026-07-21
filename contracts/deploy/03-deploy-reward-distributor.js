module.exports = async ({ getNamedAccounts, deployments, network, ethers }) => {
  const { deploy, log, get } = deployments;
  const { deployer, admin } = await getNamedAccounts();

  const labToken = await get("LABToken");
  
  log("🎁 Deploying RewardDistributor...");

  const rewardDistributor = await deploy("RewardDistributor", {
    from: deployer,
    args: [
      labToken.address,
      admin
    ],
    log: true,
    waitConfirmations: network.live ? 3 : 1
  });

  log(`✅ RewardDistributor deployed to: ${rewardDistributor.address}`);
  
  // Update LAB Token with RewardDistributor address
  log("🔄 Updating LAB Token with RewardDistributor address...");
  
  const [signer] = await ethers.getSigners();
  const labTokenContract = await ethers.getContractAt("LABToken", labToken.address, signer);
  
  try {
    const tx = await labTokenContract.setRewardDistributor(rewardDistributor.address);
    await tx.wait();
    log(`✅ LAB Token updated with RewardDistributor: ${rewardDistributor.address}`);
  } catch (error) {
    log(`❌ Failed to update LAB Token: ${error.message}`);
  }
};

module.exports.tags = ["RewardDistributor"];
module.exports.dependencies = ["LABToken"];
