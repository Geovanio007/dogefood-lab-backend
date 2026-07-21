require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("hardhat-deploy");

module.exports = {
  solidity: "0.8.24",
  namedAccounts: {
    deployer: {
      default: 0, // first account derived from PRIVATE_KEY - pays gas, signs every deploy tx
    },
    admin: {
      default: 0, // owner baked into each contract's constructor - same wallet as deployer unless ADMIN_ADDRESS is set below
      dogeosDevnet: process.env.ADMIN_ADDRESS || 0,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    dogeosDevnet: {
      url: process.env.DOGEOS_RPC_URL || "https://rpc.testnet.dogeos.com",
      chainId: 6281971,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};
