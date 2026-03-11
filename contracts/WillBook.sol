pragma solidity ^0.8.24;

contract WillBook {
    struct WillEntry {
        address author;
        uint256 createdAt;
        string message;
    }

    event WillWritten(address indexed author, uint256 indexed index, uint256 createdAt, string message);

    WillEntry[] private wills;

    function writeWill(string calldata message) external {
        uint256 length = bytes(message).length;
        require(length > 0, "Empty message");
        require(length <= 2000, "Too long");

        WillEntry memory entry = WillEntry({ author: msg.sender, createdAt: block.timestamp, message: message });
        wills.push(entry);
        emit WillWritten(msg.sender, wills.length - 1, entry.createdAt, message);
    }

    function willsCount() external view returns (uint256) {
        return wills.length;
    }

    function getWills(uint256 offset, uint256 limit) external view returns (WillEntry[] memory page) {
        uint256 total = wills.length;
        if (offset >= total) {
            return new WillEntry[](0);
        }

        uint256 remaining = total - offset;
        uint256 size = limit < remaining ? limit : remaining;
        page = new WillEntry[](size);

        for (uint256 i = 0; i < size; i++) {
            page[i] = wills[total - 1 - (offset + i)];
        }
    }
}
