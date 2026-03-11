pragma solidity ^0.8.24;

contract WishBook {
    struct WishEntry {
        uint256 id;
        address author;
        uint256 createdAt;
        string message;
    }

    event WishWritten(address indexed author, uint256 indexed id, uint256 createdAt, string message);
    event Donated(address indexed donor, address indexed author, uint256 indexed id, uint256 amount);
    event Withdrawn(address indexed author, uint256 amount);

    WishEntry[] private wishes;
    mapping(uint256 => uint256) public donationsByWish;
    mapping(address => uint256) public claimable;

    function writeWish(string calldata message) external {
        uint256 length = bytes(message).length;
        require(length > 0, "Empty message");
        require(length <= 2000, "Too long");

        uint256 id = wishes.length;
        WishEntry memory entry =
            WishEntry({ id: id, author: msg.sender, createdAt: block.timestamp, message: message });
        wishes.push(entry);
        emit WishWritten(msg.sender, id, entry.createdAt, message);
    }

    function donate(uint256 id) external payable {
        require(msg.value > 0, "Zero donation");
        require(id < wishes.length, "Invalid id");

        address author = wishes[id].author;
        claimable[author] += msg.value;
        donationsByWish[id] += msg.value;
        emit Donated(msg.sender, author, id, msg.value);
    }

    function withdraw() external {
        uint256 amount = claimable[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        claimable[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{ value: amount }("");
        require(ok, "Withdraw failed");
        emit Withdrawn(msg.sender, amount);
    }

    function wishesCount() external view returns (uint256) {
        return wishes.length;
    }

    function getWishes(uint256 offset, uint256 limit) external view returns (WishEntry[] memory page) {
        uint256 total = wishes.length;
        if (offset >= total) {
            return new WishEntry[](0);
        }

        uint256 remaining = total - offset;
        uint256 size = limit < remaining ? limit : remaining;
        page = new WishEntry[](size);

        for (uint256 i = 0; i < size; i++) {
            page[i] = wishes[total - 1 - (offset + i)];
        }
    }
}
