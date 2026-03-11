export const WILLBOOK_ABI = [
  "function writeWill(string message) external",
  "function willsCount() external view returns (uint256)",
  "function getWills(uint256 offset, uint256 limit) external view returns (tuple(address author,uint256 createdAt,string message)[] page)",
  "event WillWritten(address indexed author,uint256 indexed index,uint256 createdAt,string message)"
];

export function getContractAddress(): string | null {
  const address = import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined;
  if (!address) return null;
  return address;
}
