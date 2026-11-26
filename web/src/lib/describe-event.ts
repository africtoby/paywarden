import { formatMoney, shortAddress } from "./format";
import type { VaultEvent } from "./use-logs";

/** One plain-English line per on-chain event. */
export function describeEvent(e: VaultEvent): string {
  const a = e.args;
  switch (e.name) {
    case "Deposited": return `Deposited ${formatMoney(a.amount as bigint)}`;
    case "Withdrawn": return `Withdrew ${formatMoney(a.amount as bigint)}`;
    case "ReviewWindowSet": return "Review window changed";
    case "PayeeInvited": return "Payee invited";
    case "PayeeConfirmed": return `Payee confirmed with ${shortAddress(String(a.wallet))}`;
    case "PayeeRevoked": return `Payee wallet ${shortAddress(String(a.wallet))} unlinked`;
    case "AgentIdentityRegistered": return "Assistant identity registered";
    case "RunProposed": return `Assistant drafted a run of ${formatMoney(a.total as bigint)}`;
    case "RunApproved": return "You approved a run";
    case "RunCancelled": return "You cancelled a run";
    case "RunExecuted": return `Run paid: ${formatMoney(a.total as bigint)} to ${String(a.payees)} people`;
    case "PayeePaid": return `Paid ${formatMoney(a.amount as bigint)} to ${shortAddress(String(a.wallet))}`;
    case "PolicySet": return "Assistant permissions saved";
    case "PolicyRevokedByOwner": return "Assistant switched off";
    case "SpendRecorded": return "Spend recorded against the allowance";
    case "Paused": return "Vault paused";
    case "Unpaused": return "Vault unpaused";
    default: return e.name.replace(/([a-z])([A-Z])/g, "$1 $2");
  }
}
