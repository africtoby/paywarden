import { z } from "zod";

// Anything an LLM or a rule parser produces must fit this shape before plain code touches it.
const num = z.union([z.number(), z.string()]).transform((v) => String(v).trim());

export const timesheetSchema = z.object({
  memo: z.string().max(200).default(""),
  entries: z
    .array(z.object({ name: z.string().trim().min(1).max(80), hours: num, rate: num }))
    .min(1)
    .max(50),
});
export type Timesheet = z.infer<typeof timesheetSchema>;

// What the agent actually proposes from: one line per worker, amount in dollars, each line signed by that worker.
// The signature is optional here so the validator can name the person whose line is unsigned.
export const signedSheetSchema = z.object({
  memo: z.string().max(200).default(""),
  lines: z
    .array(z.object({ name: z.string().trim().min(1).max(80), amount: num, signature: z.string().trim().optional() }))
    .min(1)
    .max(50),
});
export type SignedSheet = z.infer<typeof signedSheetSchema>;
