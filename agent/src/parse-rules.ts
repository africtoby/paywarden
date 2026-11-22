import { timesheetSchema, type Timesheet } from "./timesheet.js";

/**
 * No-LLM parser. Format, one line per person:
 *   Ada Lovelace, 40, 25.50
 * Optional line: "memo: Week 12"
 */
export function parseRules(text: string): Timesheet {
  let memo = "";
  const entries: { name: string; hours: string; rate: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^memo\s*:\s*(.*)$/i.exec(line);
    if (m) {
      memo = m[1]!;
      continue;
    }
    const parts = line.split(",").map((s) => s.trim());
    if (parts.length !== 3) throw new Error(`Cannot read line "${line}". Use: name, hours, rate`);
    entries.push({ name: parts[0]!, hours: parts[1]!, rate: parts[2]! });
  }
  return timesheetSchema.parse({ memo, entries });
}
