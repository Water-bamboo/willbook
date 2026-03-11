export const WISHBOOK_ABI = [
  "function writeWish(string message) external",
  "function donate(uint256 id) external payable",
  "function withdraw() external",
  "function claimable(address author) external view returns (uint256)",
  "function donationsByWish(uint256 id) external view returns (uint256)",
  "function wishesCount() external view returns (uint256)",
  "function getWishes(uint256 offset, uint256 limit) external view returns (tuple(uint256 id,address author,uint256 createdAt,string message)[] page)",
  "event WishWritten(address indexed author,uint256 indexed id,uint256 createdAt,string message)",
  "event Donated(address indexed donor,address indexed author,uint256 indexed id,uint256 amount)",
  "event Withdrawn(address indexed author,uint256 amount)"
];

export function getContractAddress(): string | null {
  const address = import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined;
  if (!address) return null;
  return address;
}
