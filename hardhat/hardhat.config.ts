import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import type { HardhatUserConfig } from "hardhat/config";
import { vars } from "hardhat/config";
import "solidity-coverage";

// Run 'npx hardhat vars setup' to see the list of variables that need to be set
const MNEMONIC: string = vars.get("MNEMONIC", "test test test test test test test test test test test junk");
const ALCHEMY_API_KEY = vars.get("ALCHEMY_API_KEY", "");
const INFURA_API_KEY = vars.get("INFURA_API_KEY", "");
// Default dummy key (only for compilation, never for deployment)
const PRIVATE_KEY = vars.get("PRIVATE_KEY", "0x0000000000000000000000000000000000000000000000000000000000000001");
const ETHERSCAN_API_KEY = vars.get("ETHERSCAN_API_KEY", "");

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic: MNEMONIC,
      },
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
    // Zama FHEVM Devnet - gerçek FHEVM network
    zama: {
      url: "https://devnet.zama.ai",
      accounts: [PRIVATE_KEY],
      chainId: 9000,
      gasPrice: "auto",
      gas: "auto",
      timeout: 120000,
    },
    // FHEVM Sepolia - backup
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
      gasPrice: 20000000000, // 20 gwei
      timeout: 120000,
    },
    mainnet: {
      url: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [PRIVATE_KEY],
      chainId: 1,
      gasPrice: "auto",
      gas: "auto",
    }
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      mainnet: ETHERSCAN_API_KEY,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  solidity: {
    version: "0.8.27", // Updated to match template
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/hardhat-template/issues/31
        bytecodeHash: "none",
      },
      // Disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 50, // Minimized for contract size
      },
      viaIR: true, // Enable via-IR to fix stack too deep issues
      evmVersion: "cancun", // Match template
    },
  },
  mocha: {
    timeout: 120000,
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

export default config;