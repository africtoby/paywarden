import { formatAmount, shortAddress } from "./format";
import type { VaultEvent } from "./use-logs";

/** One plain-English line per on-chain event. */
export function describeEvent(e: VaultEvent): string {
  const a = e.args;
  switch (e.name) {
    case "Deposited": return `Deposited ${formatAmount(a.amount as bigint)} tUSD8`;
    case "Withdrawn": return `Withdrew ${formatAmount(a.amount as bigint)} tUSD8`;
    case "ReviewWindowSet": return "Review window changed";
    case "PayeeInvited": return "Payee invited";
    case "PayeeConfirmed": return `Payee confirmed with ${shortAddress(String(a.wallet))}`;
    case "PayeeRevoked": return `Payee wallet ${shortAddress(String(a.wallet))} unlinked`;
    case "AgentIdentityRegistered": return "Assistant identity registered";
    case "RunProposed": return `Assistant drafted a run of ${formatAmount(a.total as bigint)} tUSD8`;
    case "RunApproved": return "You approved a run";
    case "RunCancelled": return "You cancelled a run";
    case "RunExecuted": return `Run paid: ${formatAmount(a.total as bigint)} tUSD8 to ${String(a.payees)} people`;
    case "PayeePaid": return `Paid ${formatAmount(a.amount as bigint)} tUSD8 to ${shortAddress(String(a.wallet))}`;
    case "PolicySet": return "Assistant permissions saved";
    case "PolicyRevokedByOwner": return "Assistant switched off";
    case "SpendRecorded": return "Spend recorded against the allowance";
    case "Paused": return "Vault paused";
    case "Unpaused": return "Vault unpaused";
    default: return e.name.replace(/([a-z])([A-Z])/g, "$1 $2");
  }
}
