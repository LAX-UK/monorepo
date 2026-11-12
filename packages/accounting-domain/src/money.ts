import { type Result, ok, refuse } from "./result.js";

/** Money is always a whole number of pence (GBP). Never a float, never pounds. */
export type Pence = number;

export const CURRENCY = "GBP" as const;

export const VAT_TREATMENTS = [
  "standard",
  "zero",
  "exempt",
  "margin_scheme",
  "outside_scope",
] as const;
export type VatTreatment = (typeof VAT_TREATMENTS)[number];

/** UK standard rate, in basis points (20.00%). */
export const STANDARD_VAT_RATE_BPS = 2000;

export function isPence(value: unknown): value is Pence {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/**
 * VAT on a net amount, rounded half-up to the penny. Only `standard` carries VAT: zero, exempt and
 * outside scope are 0 by definition, and margin-scheme invoices never show VAT to the customer.
 * Net must be a non-negative integer; credit notes carry positive lines and a kind, not negatives.
 */
export function vatForLine(
  netPence: Pence,
  treatment: VatTreatment,
  rateBps: number = STANDARD_VAT_RATE_BPS,
): Pence {
  if (!isPence(netPence) || netPence < 0) throw new RangeError("net must be non-negative pence");
  if (!Number.isInteger(rateBps) || rateBps < 0) throw new RangeError("rate must be whole bps");
  if (treatment !== "standard") return 0;
  // floor((net * bps + 5000) / 10000) is half-up for non-negative integers, with no float step.
  return Math.floor((netPence * rateBps + 5000) / 10000);
}

export interface Line {
  readonly description: string;
  readonly quantity: number;
  readonly unitNetPence: Pence;
  readonly treatment: VatTreatment;
  readonly vatPence: Pence;
}

export interface LineInput {
  readonly description: string;
  readonly quantity: number;
  readonly unitNetPence: Pence;
  readonly treatment: VatTreatment;
}

export type LineCode = "bad_quantity" | "bad_amount" | "bad_treatment" | "bad_description";

export function lineNetPence(line: Pick<Line, "quantity" | "unitNetPence">): Pence {
  return line.quantity * line.unitNetPence;
}

/** Build a line, computing its VAT. Refuses anything that is not whole, non-negative pence. */
export function buildLine(input: LineInput): Result<Line, LineCode> {
  if (input.description.trim() === "") return refuse("bad_description", "line needs a description");
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) {
    return refuse("bad_quantity", "quantity must be a whole number of at least 1");
  }
  if (!isPence(input.unitNetPence) || input.unitNetPence < 0) {
    return refuse("bad_amount", "unit amount must be non-negative whole pence");
  }
  if (!VAT_TREATMENTS.includes(input.treatment)) {
    return refuse("bad_treatment", `unknown VAT treatment ${String(input.treatment)}`);
  }
  const net = input.quantity * input.unitNetPence;
  if (!Number.isSafeInteger(net)) return refuse("bad_amount", "line amount is too large");
  return ok({ ...input, vatPence: vatForLine(net, input.treatment) });
}

export interface Totals {
  readonly netPence: Pence;
  readonly vatPence: Pence;
  readonly grossPence: Pence;
}

/** Document totals are exactly the sum of the lines; there is no document-level rounding step. */
export function totalsOf(lines: readonly Line[]): Totals {
  let netPence = 0;
  let vatPence = 0;
  for (const line of lines) {
    netPence += lineNetPence(line);
    vatPence += line.vatPence;
  }
  return { netPence, vatPence, grossPence: netPence + vatPence };
}

export type TotalsMatch =
  | { readonly matches: true }
  | { readonly matches: false; readonly differencePence: Pence; readonly field: keyof Totals };

/**
 * Exact comparison of our totals with the provider's. A difference is a finding to review, never
 * something to paper over with an adjustment or rounding line.
 */
export function compareWithProviderTotals(ours: Totals, theirs: Totals): TotalsMatch {
  for (const field of ["netPence", "vatPence", "grossPence"] as const) {
    if (ours[field] !== theirs[field]) {
      return { matches: false, field, differencePence: theirs[field] - ours[field] };
    }
  }
  return { matches: true };
}
