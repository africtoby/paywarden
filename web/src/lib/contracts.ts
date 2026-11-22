import type { Address } from "viem";

// Deployed on Aevum (chain 44005). See docs/PROGRESS.md.
export const ADDRESSES = {
  tusd8: "0x456569838f1d43009A91ebA4263147Afd7233483",
  factory: "0x9A634535065AE7b3e3DF523d76d0d2Eed5AeB5b8",
  identityRegistry: "0xbA8b7E63CCE8b9f93E53874922947883CFc38F0e",
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
