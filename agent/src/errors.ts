import { BaseError, ContractFunctionRevertedError } from "viem";
import { money } from "./money.js";

const short = (h: string) => `${h.slice(0, 10)}...`;

/** Contract revert -> plain English. Also returns the raw error name, for tests and logs. */
export function explain(err: unknown): { name: string; message: string } {
  if (err instanceof BaseError) {
    const r = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (r instanceof ContractFunctionRevertedError && r.data) {
      const a = r.data.args as readonly unknown[] | undefined;
      const name = r.data.errorName;
      const text: Record<string, string> = {
        NotAgent: "This wallet is not the assistant set on the vault.",
        PolicyRevoked: "The owner switched the assistant off.",
        PolicyExpired: "The assistant's permission has expired.",
        PerRunCapExceeded: `This run is ${money(a?.[0])} but the per-run limit is ${money(a?.[1])}.`,
        PerPayeeCapExceeded: `One person's pay (${money(a?.[1])}) is over the per-person limit (${money(a?.[2])}).`,
        PeriodCapExceeded: `This run is ${money(a?.[0])} but only ${money(a?.[1])} is left in this period.`,
        PayeeNotConfirmed: `Payee ${short(String(a?.[0]))} has not confirmed their wallet yet.`,
        DuplicateRun: "This exact run was already proposed.",
        DuplicatePayee: "A person is listed twice in the run.",
        EnforcedPause: "The vault is paused.",
        EmptyRun: "The run has no payees.",
        TooManyPayees: "Too many payees in one run.",
        ZeroAmount: "A payment of zero is not allowed.",
        LengthMismatch: "Payees and amounts do not match.",
      };
      return { name, message: text[name] ?? `The contract refused the run (${name}).` };
    }
  }
  return { name: "Unknown", message: err instanceof Error ? err.message : String(err) };
}

/** Network trouble is worth retrying; a contract revert never is. */
export function isRetryable(err: unknown): boolean {
  if (err instanceof BaseError && err.walk((e) => e instanceof ContractFunctionRevertedError)) return false;
  return true;
}
