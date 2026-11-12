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

/** Largest net amount of one line (£1bn). Keeps every product and sum inside safe integers. */
export const MAX_LINE_NET_PENCE = 100_000_000_000;
/** Most lines on one document; with the line cap this bounds a total at 10^14 pence. */
export const MAX_LINES = 1000;

export type VatCode = "bad_amount" | "bad_rate";

/**
 * VAT on a net amount, rounded half-up to the penny. Only `standard` carries VAT: zero, exempt and
 * outside scope are 0 by definition, and margin-scheme invoices never show VAT to the customer.
 * Net must be a non-negative integer; credit notes carry positive lines and a kind, not negatives.
 */
export function vatForLine(
  netPence: Pence,
  treatment: VatTreatment,
  rateBps: number = STANDARD_VAT_RATE_BPS,
): Result<Pence, VatCode> {
  if (!isPence(netPence) || netPence < 0 || netPence > MAX_LINE_NET_PENCE) {
    return refuse("bad_amount", "net must be non-negative whole pence within the line cap");
  }
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10_000) {
    return refuse("bad_rate", "rate must be whole basis points up to 100%");
  }
  if (treatment !== "standard") return ok(0);
  // floor((net * bps + 5000) / 10000) is half-up for non-negative integers, with no float step.
  return ok(Math.floor((netPence * rateBps + 5000) / 10000));
}

declare const lineBrand: unique symbol;

export const LINE_ROLES = ["goods", "delivery"] as const;
/** Goods and delivery are refunded and credited separately, so every line says which it is. */
export type LineRole = (typeof LINE_ROLES)[number];

/**
 * A validated line. The brand means only `buildLine` can make one: a hand-written object literal,
 * or a row read back from storage, does not type-check as a `Line`.
 */
export interface Line {
  readonly [lineBrand]: true;
  readonly description: string;
  readonly quantity: number;
  readonly unitNetPence: Pence;
  readonly treatment: VatTreatment;
  readonly role: LineRole;
  readonly vatPence: Pence;
}

export interface LineInput {
  readonly description: string;
  readonly quantity: number;
  readonly unitNetPence: Pence;
  readonly treatment: VatTreatment;
  readonly role: LineRole;
}

export type LineCode =
  | "bad_quantity"
  | "bad_amount"
  | "bad_treatment"
  | "bad_description"
  | "bad_role";

export function lineNetPence(line: Pick<Line, "quantity" | "unitNetPence">): Pence {
  return line.quantity * line.unitNetPence;
}

export function lineGrossPence(line: Line): Pence {
  return lineNetPence(line) + line.vatPence;
}

/** Build a line, computing its VAT. Refuses anything that is not whole, non-negative, capped pence. */
export function buildLine(input: LineInput): Result<Line, LineCode> {
  if (typeof input.description !== "string" || input.description.trim() === "") {
    return refuse("bad_description", "line needs a description");
  }
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) {
    return refuse("bad_quantity", "quantity must be a whole number of at least 1");
  }
  if (!isPence(input.unitNetPence) || input.unitNetPence < 0) {
    return refuse("bad_amount", "unit amount must be non-negative whole pence");
  }
  if (!VAT_TREATMENTS.includes(input.treatment)) {
    return refuse("bad_treatment", `unknown VAT treatment ${String(input.treatment)}`);
  }
  if (!LINE_ROLES.includes(input.role)) return refuse("bad_role", "line is goods or delivery");
  const net = input.quantity * input.unitNetPence;
  if (!Number.isSafeInteger(net) || net > MAX_LINE_NET_PENCE) {
    return refuse("bad_amount", "line amount is too large");
  }
  const vat = vatForLine(net, input.treatment);
  if (!vat.ok) return refuse("bad_amount", vat.refusal.message);
  return ok({
    description: input.description,
    quantity: input.quantity,
    unitNetPence: input.unitNetPence,
    treatment: input.treatment,
    role: input.role,
    vatPence: vat.value,
  } as Line);
}

/**
 * A one-quantity line for a known gross, used for partial credits. The VAT is taken out of the
 * gross (half-up) rather than added to a net, so every gross amount from 0 up to the line cap is
 * representable; the net is the gross less that VAT. Only `standard` carries VAT.
 */
export function buildInclusiveLine(
  input: Omit<LineInput, "quantity" | "unitNetPence"> & { readonly grossPence: Pence },
): Result<Line, LineCode> {
  const { grossPence, ...rest } = input;
  if (!isPence(grossPence) || grossPence < 0 || grossPence > MAX_LINE_NET_PENCE) {
    return refuse("bad_amount", "gross must be non-negative whole pence within the line cap");
  }
  const checked = buildLine({ ...rest, quantity: 1, unitNetPence: 0 });
  if (!checked.ok) return checked;
  const divisor = 10_000 + STANDARD_VAT_RATE_BPS;
  const vat =
    rest.treatment === "standard"
      ? Math.floor((grossPence * STANDARD_VAT_RATE_BPS + divisor / 2) / divisor)
      : 0;
  return ok({ ...checked.value, unitNetPence: grossPence - vat, vatPence: vat } as Line);
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
export function isTotals(value: unknown): value is Totals {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return isPence(v.netPence) && isPence(v.vatPence) && isPence(v.grossPence);
}

export function compareWithProviderTotals(ours: Totals, theirs: Totals): TotalsMatch {
  for (const field of ["netPence", "vatPence", "grossPence"] as const) {
    if (ours[field] !== theirs[field]) {
      return { matches: false, field, differencePence: theirs[field] - ours[field] };
    }
  }
  return { matches: true };
}
