import { parseAbi } from "viem";

// Minimal slice of PayrollVault + AgentSpendPolicy. The error lines let viem name a revert.
export const vaultAbi = parseAbi([
  "function proposeRun(bytes32[] payeeIds, uint256[] amounts, bytes32 memoHash, bytes[] signatures) returns (bytes32 runKey)",
  "function payeeWallet(bytes32 payeeId) view returns (address)",
  "function runStatus(bytes32 runKey) view returns (uint8)",
  "function commitmentOf(string name, bytes32 salt) pure returns (bytes32)",
  "event RunProposed(bytes32 indexed runKey, address indexed agent, bytes32 memoHash, uint256 total, uint64 executableAt)",
  // vault
  "error EnforcedPause()",
  "error EmptyRun()",
  "error TooManyPayees(uint256 count)",
  "error LengthMismatch()",
  "error ZeroAmount()",
  "error DuplicatePayee(bytes32 payeeId)",
  "error PayeeNotConfirmed(bytes32 payeeId)",
  "error DuplicateRun(bytes32 runKey)",
  "error InvalidWorkerSignature(bytes32 payeeId)",
  "error LineAlreadyPaid(bytes32 payeeId, bytes32 memoHash)",
  // policy (bubbles up through checkRun)
  "error NotAgent()",
  "error PolicyRevoked()",
  "error PolicyExpired()",
  "error PerRunCapExceeded(uint256 total, uint256 cap)",
  "error PerPayeeCapExceeded(bytes32 payeeId, uint256 amount, uint256 cap)",
  "error PeriodCapExceeded(uint256 total, uint256 remaining)",
]);
