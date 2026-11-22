import { formatAmount } from "./format";

export type SentenceInput = {
  perPayee: bigint;
  perRun: bigint;
  periodCap: bigint;
  periodDays: number;
  /** Unix seconds, or null when the permission never expires. */
  expiry: number | null;
};

/** "It can pay up to 800 per person, 2,000 per run and 5,000 every 30 days, until 12 Mar 2027." */
export function permissionSentence(s: SentenceInput): string {
  const days = s.periodDays === 30 ? "a month" : s.periodDays === 7 ? "a week" : `every ${s.periodDays} days`;
  const until = s.expiry === null ? "with no end date" : `until ${new Date(s.expiry * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  return `It can pay up to ${formatAmount(s.perPayee)} per person, ${formatAmount(s.perRun)} per run and ${formatAmount(s.periodCap)} ${days}, ${until}. It can never approve or pay.`;
}
