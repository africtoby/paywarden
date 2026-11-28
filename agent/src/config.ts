import "dotenv/config";
import type { Address, Hex } from "viem";

export type Config = {
  rpcUrl: string;
  chainId: number;
  agentKey: Hex;
  vault: Address;
  useLlm: boolean;
  llmKey?: string;
  llmModel: string;
  /** "eoa" (default): the agent key sends proposeRun itself. "smart-account": the agent key is an
   * ERC-4337 session key on the employer's AgentAccount, and a relayer key submits the user operation. */
  mode: "eoa" | "smart-account";
  smartAccount?: Address;
  relayerKey?: Hex;
};

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. Add it to your .env file (see .env.example).`);
  return v;
}

export function loadConfig(): Config {
  const mode = process.env.AGENT_MODE === "smart-account" ? "smart-account" : "eoa";
  return {
    mode,
    smartAccount: mode === "smart-account" ? (need("SMART_ACCOUNT_ADDRESS") as Address) : undefined,
    relayerKey: mode === "smart-account" ? (need("RELAYER_PRIVATE_KEY") as Hex) : undefined,
    rpcUrl: process.env.RPC_URL ?? "https://rpc-test.qday.info",
    chainId: Number(process.env.CHAIN_ID ?? 44005),
    agentKey: need("AGENT_PRIVATE_KEY") as Hex,
    vault: need("VAULT_ADDRESS") as Address,
    useLlm: process.env.USE_LLM_PARSER !== "false" && !!process.env.LLM_API_KEY,
    llmKey: process.env.LLM_API_KEY,
    llmModel: process.env.LLM_MODEL ?? "claude-haiku-5-5",
  };
}
