import { loadConfig } from "./config.js";
import { money } from "./money.js";
import { runAgent } from "./run.js";

const [timesheet, payees = "payees.json"] = process.argv.slice(2);
if (!timesheet) {
  console.error("Usage: npm run propose -- <timesheet.txt> [payees.json]");
  process.exit(1);
}
try {
  const { proposal, outcome } = await runAgent(loadConfig(), timesheet, payees);
  for (const l of proposal.lines) console.log(`  ${l.name}: ${money(l.amount)}`);
  if (outcome.status === "proposed") console.log(`Proposed. The owner can review it now. Tx ${outcome.txHash}`);
  else if (outcome.status === "already-proposed") console.log("This exact run was already proposed. Nothing new was sent.");
  else {
    console.error(`Refused by the contract: ${outcome.message}`);
    process.exit(2);
  }
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
