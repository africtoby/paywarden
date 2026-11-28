import type { Address } from "viem";

// Deployed on Aevum (chain 44005). Addresses and proof transactions are listed in the README.
export const ADDRESSES = {
  tusd8: "0x456569838f1d43009A91ebA4263147Afd7233483",
  factory: "0xfaC8ebb7D8f494618068B7eF86FF9A0767b34209",
  identityRegistry: "0x65b0B1df79B5A61021feF2BfA489a49A6b646F85",
} as const satisfies Record<string, Address>;

export const TOKEN_DECIMALS = 6; // tUSD8
export const TOKEN_SYMBOL = "tUSD8";

export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

export { payrollVaultAbi } from "./abi/PayrollVault";
export { agentSpendPolicyAbi } from "./abi/AgentSpendPolicy";
export { payrollVaultFactoryAbi } from "./abi/PayrollVaultFactory";
export { identityRegistryAbi } from "./abi/IdentityRegistry";

export const RUN_STATUS = ["None", "Proposed", "Approved", "Cancelled", "Executed"] as const;
export type RunStatus = (typeof RUN_STATUS)[number];
