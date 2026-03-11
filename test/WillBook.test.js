const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WillBook", function () {
  it("writes and reads wills", async function () {
    const WillBook = await ethers.getContractFactory("WillBook");
    const willBook = await WillBook.deploy();

    await willBook.writeWill("hello");
    await willBook.writeWill("bye");

    expect(await willBook.willsCount()).to.eq(2n);

    const page = await willBook.getWills(0, 10);
    expect(page.length).to.eq(2);
    expect(page[0].message).to.eq("bye");
    expect(page[1].message).to.eq("hello");
  });
});
