import { CHECK_LABELS } from "./demo-rules";
import { MESSAGES } from "./errors";
import type { RunStatus } from "./contracts";
import type { PolicyView } from "./use-vault";

export type RunCheck = { label: string; ok: boolean };

export type RunCheckInput = {
  amounts: readonly bigint[];
  total: bigint;
  status: RunStatus;
  /** Number of payees in the run that have confirmed their wallet. */
  confirmedCount: number;
  payeeCount: number;
  policy?: PolicyView;
  revoked?: boolean;
  paused?: boolean;
  remaining?: bigint;
  /** Unix seconds. */
  now: number;
};

/**
 * The seven checks the contract enforces, evaluated against live state.
 * A run that is already paid passed them all when it was signed, so it shows 7/7.
 * `refusal` is the plain-English reason for the first failing check, in the order the contract reverts.
 */
export function checkRun(r: RunCheckInput): { checks: RunCheck[]; refusal: string | null } {
  if (r.status === "Executed") return { checks: CHECK_LABELS.map((label) => ({ label, ok: true })), refusal: null };

  const p = r.policy;
  const overPerson = p ? r.amounts.find((a) => a > p.perPayee) : undefined;
  const left = r.remaining ?? 0n;
  const expired = !p || r.revoked || (p.expiry !== 0n && BigInt(r.now) >= p.expiry);

  const oks = [
    r.confirmedCount === r.payeeCount,
    !!p && overPerson === undefined,
    !!p && r.total <= p.perRun,
    r.total <= left,
    !expired,
    !r.paused,
    true,
  ];
  const checks = CHECK_LABELS.map((label, i) => ({ label, ok: oks[i] }));

  let refusal: string | null = null;
  if (!oks[0]) refusal = MESSAGES.PayeeNotConfirmed([]);
  else if (r.revoked) refusal = MESSAGES.PolicyRevoked([]);
  else if (!oks[4]) refusal = MESSAGES.PolicyExpired([]);
  else if (!oks[5]) refusal = MESSAGES.EnforcedPause([]);
  else if (p && overPerson !== undefined) refusal = MESSAGES.PerPayeeCapExceeded([0n, overPerson, p.perPayee]);
  else if (p && r.total > p.perRun) refusal = MESSAGES.PerRunCapExceeded([r.total, p.perRun]);
  else if (!oks[3]) refusal = MESSAGES.PeriodCapExceeded([r.total, left]);
  return { checks, refusal };
}
