const hre = require("hardhat");

async function main() {
  const WishBook = await hre.ethers.getContractFactory("WishBook");
  const wishBook = await WishBook.deploy();
  await wishBook.waitForDeployment();

  const address = await wishBook.getAddress();
  console.log("WishBook deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
