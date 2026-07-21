// DogeOS DEX router (Uniswap V2-style: addLiquidityETH/factory/WETH). Used
// by GraduationManager to seed and lock liquidity when a token graduates.
const DOGEOS_DEX_ROUTER = "0x8D43C135b7040C27542A4f33c34c874c94e1B437";

module.exports = async ({ getNamedAccounts, deployments, network, ethers }) => {
  const { deploy, log, get } = deployments;
  const { deployer, admin } = await getNamedAccounts();

  const labToken = await get("LABToken");

  log("🏦 Deploying LauncherTreasury...");
  const treasury = await deploy("LauncherTreasury", {
    from: deployer,
    args: [admin],
    log: true,
    waitConfirmations: network.live ? 3 : 1
  });
  log(`✅ LauncherTreasury deployed to: ${treasury.address}`);

  log("💸 Deploying RoyaltyDistributor...");
  const royaltyDistributor = await deploy("RoyaltyDistributor", {
    from: deployer,
    args: [admin],
    log: true,
    waitConfirmations: network.live ? 3 : 1
  });
  log(`✅ RoyaltyDistributor deployed to: ${royaltyDistributor.address}`);

  log("📈 Deploying BondingCurve...");
  const bondingCurve = await deploy("BondingCurve", {
    from: deployer,
    args: [treasury.address, admin],
    log: true,
    waitConfirmations: network.live ? 3 : 1
  });
  log(`✅ BondingCurve deployed to: ${bondingCurve.address}`);

  log("🎓 Deploying GraduationManager...");
  const graduationManager = await deploy("GraduationManager", {
    from: deployer,
    args: [bondingCurve.address, admin],
    log: true,
    waitConfirmations: network.live ? 3 : 1
  });
  log(`✅ GraduationManager deployed to: ${graduationManager.address}`);

  log("🚀 Deploying LaunchpadFactory...");
  const launchpadFactory = await deploy("LaunchpadFactory", {
    from: deployer,
    args: [bondingCurve.address, royaltyDistributor.address, treasury.address, graduationManager.address, admin],
    log: true,
    waitConfirmations: network.live ? 3 : 1
  });
  log(`✅ LaunchpadFactory deployed to: ${launchpadFactory.address}`);

  log("🎮 Deploying GamePaymentGateway...");
  const gamePaymentGateway = await deploy("GamePaymentGateway", {
    from: deployer,
    args: [labToken.address, bondingCurve.address, treasury.address, admin],
    log: true,
    waitConfirmations: network.live ? 3 : 1
  });
  log(`✅ GamePaymentGateway deployed to: ${gamePaymentGateway.address}`);

  // Wire BondingCurve and RoyaltyDistributor up to the factory, and
  // BondingCurve to its GraduationManager. These are admin-only setters
  // (see setFactory / setGraduationManager in each contract) rather than
  // constructor args, because LaunchpadFactory's own constructor needs
  // BondingCurve's and RoyaltyDistributor's addresses, which only exist
  // once those two are already deployed - so the wiring has to happen
  // after the fact, from the admin account, in this script.
  log("🔄 Wiring BondingCurve -> Factory...");
  const [signer] = await ethers.getSigners();
  const bondingCurveContract = await ethers.getContractAt("BondingCurve", bondingCurve.address, signer);
  try {
    const tx = await bondingCurveContract.setFactory(launchpadFactory.address);
    await tx.wait();
    log(`✅ BondingCurve.factory set to: ${launchpadFactory.address}`);
  } catch (error) {
    log(`❌ Failed to set BondingCurve.factory: ${error.message}`);
  }

  log("🔄 Wiring BondingCurve -> GraduationManager...");
  try {
    const tx = await bondingCurveContract.setGraduationManager(graduationManager.address);
    await tx.wait();
    log(`✅ BondingCurve.graduationManager set to: ${graduationManager.address}`);
  } catch (error) {
    log(`❌ Failed to set BondingCurve.graduationManager: ${error.message}`);
  }

  log("🔄 Wiring RoyaltyDistributor -> Factory...");
  const royaltyDistributorContract = await ethers.getContractAt("RoyaltyDistributor", royaltyDistributor.address, signer);
  try {
    const tx = await royaltyDistributorContract.setFactory(launchpadFactory.address);
    await tx.wait();
    log(`✅ RoyaltyDistributor.factory set to: ${launchpadFactory.address}`);
  } catch (error) {
    log(`❌ Failed to set RoyaltyDistributor.factory: ${error.message}`);
  }

  log("🔄 Wiring GraduationManager -> DogeOS DEX router...");
  const graduationManagerContract = await ethers.getContractAt("GraduationManager", graduationManager.address, signer);
  try {
    const tx = await graduationManagerContract.setRouter(DOGEOS_DEX_ROUTER);
    await tx.wait();
    log(`✅ GraduationManager.router set to: ${DOGEOS_DEX_ROUTER}`);
  } catch (error) {
    log(`❌ Failed to set GraduationManager.router: ${error.message}`);
  }

  log(`✅ LaunchpadFactory deployed to: ${launchpadFactory.address}`);
};

module.exports.tags = ["LabLauncher"];
module.exports.dependencies = ["LABToken"];
