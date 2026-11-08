/**
 * The payout reference a person reads out or quotes to us, such as `PO-2026-3FA9C1D2`: the year the
 * payout's period ends, then the first eight characters of its id. It is built from fields the
 * payout already has, so it never changes and needs no new column; the id stays the address.
 */

const REFERENCE_CODE_LENGTH = 8;

export function formatPayoutReference(payout: { id: string; periodEnd: Date }): string {
  const year = Number.isNaN(payout.periodEnd.getTime())
    ? "0000"
    : String(payout.periodEnd.getUTCFullYear()).padStart(4, "0");
  const code = payout.id
    .replace(/[^0-9a-z]/gi, "")
    .slice(0, REFERENCE_CODE_LENGTH)
    .toUpperCase();
  return `PO-${year}-${code}`;
}

export type ParsedPayoutReference = {
  /** The year the payout's period ends. */
  year: number;
  /** Lower-case leading characters of the payout id. */
  idPrefix: string;
};

const REFERENCE_PATTERN = /^PO-(\d{4})-([0-9A-F]{4,8})$/i;

/**
 * Reads a `PO-YYYY-XXXXXXXX` reference back into the year and id prefix it was built from.
 * A prefix of four to eight characters is accepted, so references quoted in the earlier
 * six-character form still resolve. Returns null for anything else.
 */
export function parsePayoutReference(text: string): ParsedPayoutReference | null {
  const match = REFERENCE_PATTERN.exec(text.trim());
  if (!match) return null;
  return { year: Number(match[1]), idPrefix: (match[2] ?? "").toLowerCase() };
}

export type PayoutSearch =
  | { kind: "reference"; year: number; idPrefix: string }
  | { kind: "id"; idPrefix: string }
  | { kind: "text"; text: string };

/**
 * What an admin payout search box means: a payout reference (match by id prefix and year), the
 * start of a payout id, or otherwise a seller name. Null when the box is empty.
 */
export function parsePayoutSearch(input: string): PayoutSearch | null {
  const text = input.trim();
  if (!text) return null;
  const reference = parsePayoutReference(text);
  if (reference) return { kind: "reference", ...reference };
  if (/^[0-9a-f]{4,}(-[0-9a-f]*)*$/i.test(text) && text.replace(/-/g, "").length <= 32) {
    return { kind: "id", idPrefix: text.toLowerCase() };
  }
  return { kind: "text", text };
}
