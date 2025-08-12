require("@nomicfoundation/hardhat-toolbox");
require("hardhat-deploy");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "e092de009624cb1016e1ce196d0dd40a40942c47a5efe25df3b1535f29c89e81";
const DOGEOS_DEVNET_RPC = process.env.DOGEOS_DEVNET_RPC || "https://rpc-devnet.dogechain.dog/";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    dogeosDevnet: {
      url: DOGEOS_DEVNET_RPC,
      accounts: [PRIVATE_KEY],
      chainId: 221122420,
      gasPrice: 20000000000,
      gas: 6000000,
      timeout: 60000,
      httpHeaders: {}
    }
  },
  namedAccounts: {
    deployer: {
      default: 0
    },
    admin: {
      default: "0x2ea897De823F9A7e4B292d1674BA3a2a86BAFba2"
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "./deploy"
  }
};