import { formatMoney } from "./format";

export type SentenceInput = {
  perPayee: bigint;
  perRun: bigint;
  periodCap: bigint;
  periodDays: number;
  /** Unix seconds, or null when the permission never expires. */
  expiry: number | null;
};

export type SentencePart = { text: string; /** True for a figure or date the owner can change. */ value: boolean };

/** The sentence in pieces, so the page can mark the parts that change. */
export function permissionParts(s: SentenceInput): SentencePart[] {
  const days = s.periodDays === 30 ? "a month" : s.periodDays === 7 ? "a week" : `every ${s.periodDays} days`;
  const until = s.expiry === null ? "with no end date" : `until ${new Date(s.expiry * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  return [
    { text: "It can pay up to ", value: false },
    { text: formatMoney(s.perPayee), value: true },
    { text: " per person, ", value: false },
    { text: formatMoney(s.perRun), value: true },
    { text: " per run and ", value: false },
    { text: formatMoney(s.periodCap), value: true },
    { text: ` ${days}`, value: true },
    { text: ", ", value: false },
    { text: until, value: true },
    { text: ". It can never approve or pay.", value: false },
  ];
}

/** "It can pay up to $800 per person, $2,000 per run and $5,000 every 30 days, until 12 Mar 2027." */
export function permissionSentence(s: SentenceInput): string {
  return permissionParts(s).map((p) => p.text).join("");
}
