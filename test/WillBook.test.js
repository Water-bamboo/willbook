const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WillBook", function () {
  it("writes and reads wishes", async function () {
    const WishBook = await ethers.getContractFactory("WishBook");
    const wishBook = await WishBook.deploy();

    await wishBook.writeWish("hello");
    await wishBook.writeWish("bye");

    expect(await wishBook.wishesCount()).to.eq(2n);

    const page = await wishBook.getWishes(0, 10);
    expect(page.length).to.eq(2);
    expect(page[0].message).to.eq("bye");
    expect(page[1].message).to.eq("hello");
  });

  it("accepts donations and allows withdraw", async function () {
    const [author, donor] = await ethers.getSigners();
    const WishBook = await ethers.getContractFactory("WishBook");
    const wishBook = await WishBook.deploy();

    await wishBook.connect(author).writeWish("wish");
    const page = await wishBook.getWishes(0, 1);
    const id = page[0].id;

    await wishBook.connect(donor).donate(id, { value: ethers.parseEther("0.01") });
    expect(await wishBook.claimable(author.address)).to.eq(ethers.parseEther("0.01"));

    await expect(wishBook.connect(author).withdraw()).to.changeEtherBalance(author, ethers.parseEther("0.01"));
    expect(await wishBook.claimable(author.address)).to.eq(0n);
  });
});
