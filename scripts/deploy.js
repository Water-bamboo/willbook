const hre = require("hardhat");

async function main() {
  const rawPrivateKey = process.env.PRIVATE_KEY;
  const privateKey =
    rawPrivateKey && rawPrivateKey.trim()
      ? rawPrivateKey.trim().startsWith("0x")
        ? rawPrivateKey.trim()
        : `0x${rawPrivateKey.trim()}`
      : null;
  const signer = privateKey
    ? new hre.ethers.Wallet(privateKey, hre.ethers.provider)
    : (await hre.ethers.getSigners())[0];
  if (!signer) {
    throw new Error("No deployer signer available. Set PRIVATE_KEY in .env");
  }

  const WishBook = await hre.ethers.getContractFactory("WishBook", signer);
  const wishBook = await WishBook.deploy();
  await wishBook.waitForDeployment();

  const address = await wishBook.getAddress();
  console.log("WishBook deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
