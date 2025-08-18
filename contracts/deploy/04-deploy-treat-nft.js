const { network } = require("hardhat")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    
    const chainId = network.config.chainId
    
    log("------------------------------------------------------------")
    log("Deploying TreatNFT contract...")
    
    const args = [] // TreatNFT constructor takes no arguments
    
    const treatNFT = await deploy("TreatNFT", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    
    log(`TreatNFT deployed at ${treatNFT.address}`)
    
    // Verify contract on block explorer if not on hardhat network
    if (chainId !== 31337 && process.env.ETHERSCAN_API_KEY) {
        log("Verifying contract...")
        await verify(treatNFT.address, args)
    }
    
    log("------------------------------------------------------------")
}

module.exports.tags = ["all", "treatnft", "main"]