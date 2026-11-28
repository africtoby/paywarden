import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { vaultAbi } from "./abi.js";
import type { Config } from "./config.js";
import { money } from "./money.js";
import { parseLlm } from "./parse-llm.js";
import { parseRules } from "./parse-rules.js";
import { submitRun } from "./submit.js";
import { signedSheetSchema, type Timesheet } from "./timesheet.js";
import { validate, validateSigned, type PayeeRecord } from "./validate.js";

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

/** A plain-text timesheet can still be drafted, but it cannot be sent: nobody has signed it. */
export async function draftOnly(text: string, payees: PayeeRecord[], cfg: Pick<Config, "useLlm" | "llmKey" | "llmModel">): Promise<never> {
  const draft = validate(await parseTimesheet(text, cfg), payees);
  const list = draft.lines.map((l) => `${l.name} ${money(l.amount)}`).join(", ");
  throw new Error(`Draft only (${list}). Not sent: each worker must sign their own line. Save the signed lines as a .json timesheet and run again.`);
}

export async function runAgent(cfg: Config, timesheetPath: string, payeesPath: string) {
  const payees = JSON.parse(readFileSync(payeesPath, "utf8")) as PayeeRecord[];
  const raw = readFileSync(timesheetPath, "utf8");
  if (!timesheetPath.toLowerCase().endsWith(".json")) return draftOnly(raw, payees, cfg);
  const sheet = signedSheetSchema.parse(JSON.parse(raw));

  const chain = defineChain({
    id: cfg.chainId,
    name: "QDay Aevum Testnet",
    nativeCurrency: { name: "tQDAY", symbol: "tQDAY", decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
  });
  const account = privateKeyToAccount(cfg.agentKey);
  const pub = createPublicClient({ chain, transport: http() });
  const wallet = createWalletClient({ chain, account, transport: http() });
  const proposal = await validateSigned(sheet, payees, {
    vault: cfg.vault,
    chainId: cfg.chainId,
    wallet: (payeeId) => pub.readContract({ address: cfg.vault, abi: vaultAbi, functionName: "payeeWallet", args: [payeeId] }),
    verifyTypedData: (a) => pub.verifyTypedData(a),
  });
  return { proposal, outcome: await submitRun({ pub, wallet, account, vault: cfg.vault }, proposal) };
}
