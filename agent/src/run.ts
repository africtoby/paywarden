import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Config } from "./config.js";
import { parseLlm } from "./parse-llm.js";
import { parseRules } from "./parse-rules.js";
import { submitRun } from "./submit.js";
import type { Timesheet } from "./timesheet.js";
import { validate, type PayeeRecord } from "./validate.js";

export async function parseTimesheet(
  text: string,
  cfg: Pick<Config, "useLlm" | "llmKey" | "llmModel">,
): Promise<Timesheet> {
  if (cfg.useLlm && cfg.llmKey) {
    try {
      return await parseLlm(text, { apiKey: cfg.llmKey, model: cfg.llmModel });
    } catch (e) {
      console.warn(`LLM parse failed (${(e as Error).message}); using the plain parser instead.`);
    }
  }
  return parseRules(text);
}

export async function runAgent(cfg: Config, timesheetPath: string, payeesPath: string) {
  const sheet = await parseTimesheet(readFileSync(timesheetPath, "utf8"), cfg);
  const payees = JSON.parse(readFileSync(payeesPath, "utf8")) as PayeeRecord[];
  const proposal = validate(sheet, payees);

  const chain = defineChain({
    id: cfg.chainId,
    name: "QDay Aevum Testnet",
    nativeCurrency: { name: "tQDAY", symbol: "tQDAY", decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
  });
  const account = privateKeyToAccount(cfg.agentKey);
  const pub = createPublicClient({ chain, transport: http() });
  const wallet = createWalletClient({ chain, account, transport: http() });
  return { proposal, outcome: await submitRun({ pub, wallet, account, vault: cfg.vault }, proposal) };
}
