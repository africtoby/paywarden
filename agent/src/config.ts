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
};

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. Add it to your .env file (see .env.example).`);
  return v;
}

export function loadConfig(): Config {
  return {
    rpcUrl: process.env.RPC_URL ?? "https://rpc-test.qday.info",
    chainId: Number(process.env.CHAIN_ID ?? 44005),
    agentKey: need("AGENT_PRIVATE_KEY") as Hex,
    vault: need("VAULT_ADDRESS") as Address,
    useLlm: process.env.USE_LLM_PARSER !== "false" && !!process.env.LLM_API_KEY,
    llmKey: process.env.LLM_API_KEY,
    llmModel: process.env.LLM_MODEL ?? "claude-haiku-5-5",
  };
}
