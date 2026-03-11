const hre = require("hardhat");

async function main() {
  const WillBook = await hre.ethers.getContractFactory("WillBook");
  const willBook = await WillBook.deploy();
  await willBook.waitForDeployment();

  const address = await willBook.getAddress();
  console.log("WillBook deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
