const hre = require("hardhat");

async function main() {
  console.log("Deploying KrelzToken...");

  const KrelzToken = await hre.ethers.getContractFactory("KrelzToken");
  const token = await KrelzToken.deploy();
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log("KrelzToken deployed to:", tokenAddress);

  console.log("Deploying StakingPool...");

  const StakingPool = await hre.ethers.getContractFactory("StakingPool");
  const staking = await StakingPool.deploy(tokenAddress);
  await staking.waitForDeployment();

  const stakingAddress = await staking.getAddress();
  console.log("StakingPool deployed to:", stakingAddress);

  console.log("\n--- Deployment Summary ---");
  console.log("KrelzToken:", tokenAddress);
  console.log("StakingPool:", stakingAddress);
  console.log("--------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
