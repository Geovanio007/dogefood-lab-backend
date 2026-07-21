const { network } = require("hardhat")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer, admin } = await getNamedAccounts()
    
    log("------------------------------------------------------------")
    log("Deploying TreatNFT contract...")
    
    const args = [admin] // TreatNFT is Ownable as of the OZ v5 fix - owner is admin, matching DogeFood/LABToken/RewardDistributor
    
    const treatNFT = await deploy("TreatNFT", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    
    log(`TreatNFT deployed at ${treatNFT.address}`)
    
    log("------------------------------------------------------------")
}

module.exports.tags = ["all", "treatnft", "main"]
