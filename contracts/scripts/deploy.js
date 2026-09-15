const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying Krelz Network contracts to BSC Testnet...\n");

  // Deploy KrelzToken
  console.log("1️⃣ Deploying KrelzToken...");
  const KrelzToken = await hre.ethers.getContractFactory("KrelzToken");
  const token = await KrelzToken.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`   ✅ KrelzToken: ${tokenAddress}`);

  // Deploy StakingPool
  console.log("\n2️⃣ Deploying StakingPool...");
  const StakingPool = await hre.ethers.getContractFactory("StakingPool");
  const staking = await StakingPool.deploy(tokenAddress);
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  console.log(`   ✅ StakingPool: ${stakingAddress}`);

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(50));
  console.log(`Network: BSC Testnet (Chain ID: 97)`);
  console.log(`KrelzToken: ${tokenAddress}`);
  console.log(`StakingPool: ${stakingAddress}`);
  console.log(`Deployer: ${await hre.ethers.provider.getSigner().getAddress()}`);
  console.log("=".repeat(50));

  // Save addresses to file
  const fs = require('fs');
  const addresses = {
    network: 'bscTestnet',
    chainId: 97,
    krelzToken: tokenAddress,
    stakingPool: stakingAddress,
    deployer: await hre.ethers.provider.getSigner().getAddress(),
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync('./deployed-addresses.json', JSON.stringify(addresses, null, 2));
  console.log("\n💾 Addresses saved to deployed-addresses.json");

  // Add to .env
  console.log("\n📝 Add these to your backend .env:");
  console.log(`KRELZ_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`STAKING_POOL_ADDRESS=${stakingAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
