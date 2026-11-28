import { MESSAGES } from "./errors";

/**
 * Client-side mirror of the checks PayrollVault + AgentSpendPolicy enforce on a draft.
 * Used only by the landing-page demo; the real app reads the contract.
 */

/** `signed` is false only for a line nobody signed; undefined means the worker signed it. */
export type DemoLine = { name: string; wallet: string; amount: bigint; signed?: boolean };

export type DemoPolicy = {
  confirmed: ReadonlySet<string>; // lower-case wallet addresses that confirmed their invite
  perPayee: bigint;
  perRun: bigint;
  periodLeft: bigint;
  expired: boolean;
  paused: boolean;
  alreadyPaid: boolean;
};

export type DemoCheck = { label: string; ok: boolean };

export type DemoResult = {
  checks: DemoCheck[];
  total: bigint;
  /** Plain-English reason shown when the contract would refuse, otherwise null. */
  refusal: string | null;
};

export const CHECK_LABELS = [
  "Confirmed payee",
  "Per-person cap",
  "Per-run cap",
  "Monthly cap",
  "Assistant not expired",
  "Vault not paused",
  "Not already paid",
  "Signed by each worker",
] as const;

export function evaluateDraft(lines: readonly DemoLine[], p: DemoPolicy): DemoResult {
  const total = lines.reduce((s, l) => s + l.amount, 0n);
  const unconfirmed = lines.find((l) => !p.confirmed.has(l.wallet.toLowerCase()));
  const overPerson = lines.find((l) => l.amount > p.perPayee);
  const unsigned = lines.find((l) => l.signed === false);

  const oks = [
    !unconfirmed,
    !overPerson,
    total <= p.perRun,
    total <= p.periodLeft,
    !p.expired,
    !p.paused,
    !p.alreadyPaid,
    !unsigned,
  ];
  const checks = CHECK_LABELS.map((label, i) => ({ label, ok: oks[i] }));

  // Same order the contract reverts in: the first failing rule wins.
  let refusal: string | null = null;
  if (unconfirmed) refusal = MESSAGES.PayeeNotConfirmed([]);
  else if (unsigned) refusal = MESSAGES.InvalidWorkerSignature([]);
  else if (overPerson) refusal = MESSAGES.PerPayeeCapExceeded([0n, overPerson.amount, p.perPayee]);
  else if (total > p.perRun) refusal = MESSAGES.PerRunCapExceeded([total, p.perRun]);
  else if (total > p.periodLeft) refusal = MESSAGES.PeriodCapExceeded([total, p.periodLeft]);

  return { checks, total, refusal };
}
