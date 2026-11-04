/**
 * The LAX stock code: `LAX-{ORI|PRI}-{ARTIST}-{SECOND}-{YY}-{NNNN}`, for example
 * `LAX-ORI-PH-GAC-26-0001`. Staff already read and quote these, so the shape is fixed. LAX issues
 * the next number for a prefix; Zoho never does, so a code is never issued twice.
 */

export const STOCK_CODE_KINDS = ["original", "print"] as const;
export type StockCodeKind = (typeof STOCK_CODE_KINDS)[number];

const KIND_SEGMENT: Record<StockCodeKind, "ORI" | "PRI"> = { original: "ORI", print: "PRI" };
const SEGMENT_KIND: Record<string, StockCodeKind> = { ORI: "original", PRI: "print" };

export const STOCK_CODE_MAX_NUMBER = 9999;

const CODE_PART = "[A-Z0-9]{1,6}";
export const STOCK_CODE_PATTERN = new RegExp(
  `^LAX-(ORI|PRI)-(${CODE_PART})-(${CODE_PART})-(\\d{2})-(\\d{4})$`,
);
const CODE_PART_PATTERN = new RegExp(`^${CODE_PART}$`);

export type StockCodeParts = {
  kind: StockCodeKind;
  /** The artist's code, for example PH. */
  artist: string;
  /** The second code, for example GAC. */
  second: string;
  /** Two-digit year. */
  year: number;
  /** Running number within the prefix, 1 to 9999. */
  number: number;
};

export type StockCodePrefix = Omit<StockCodeParts, "number">;

export class StockCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockCodeError";
  }
}

/** Parses a stock code, or returns null when it is not in the LAX shape. */
export function parseStockCode(value: string): StockCodeParts | null {
  const match = STOCK_CODE_PATTERN.exec(value);
  if (!match) return null;
  const [, kind, artist, second, year, number] = match;
  const parsedKind = SEGMENT_KIND[kind as string];
  const parsedNumber = Number(number);
  if (!parsedKind || parsedNumber < 1) return null;
  return {
    kind: parsedKind,
    artist: artist as string,
    second: second as string,
    year: Number(year),
    number: parsedNumber,
  };
}

export function isStockCode(value: string): boolean {
  return parseStockCode(value) !== null;
}

function assertPrefix(prefix: StockCodePrefix): void {
  if (!CODE_PART_PATTERN.test(prefix.artist)) {
    throw new StockCodeError(
      `Artist code "${prefix.artist}" must be 1 to 6 capital letters or digits`,
    );
  }
  if (!CODE_PART_PATTERN.test(prefix.second)) {
    throw new StockCodeError(
      `Second code "${prefix.second}" must be 1 to 6 capital letters or digits`,
    );
  }
  if (!Number.isInteger(prefix.year) || prefix.year < 0 || prefix.year > 99) {
    throw new StockCodeError(`Year ${prefix.year} must be a two-digit year`);
  }
}

/** The part of a code shared by a run of numbers, for example `LAX-ORI-PH-GAC-26`. */
export function formatStockCodePrefix(prefix: StockCodePrefix): string {
  assertPrefix(prefix);
  const year = String(prefix.year).padStart(2, "0");
  return `LAX-${KIND_SEGMENT[prefix.kind]}-${prefix.artist}-${prefix.second}-${year}`;
}

export function formatStockCode(parts: StockCodeParts): string {
  if (!Number.isInteger(parts.number) || parts.number < 1 || parts.number > STOCK_CODE_MAX_NUMBER) {
    throw new StockCodeError(
      `Number ${parts.number} must be between 1 and ${STOCK_CODE_MAX_NUMBER}`,
    );
  }
  return `${formatStockCodePrefix(parts)}-${String(parts.number).padStart(4, "0")}`;
}

/**
 * The next code for a prefix, given the highest number already issued under it (null when none).
 * Throws when the run is full rather than reusing a number.
 */
export function nextStockCode(prefix: StockCodePrefix, highestIssued: number | null): string {
  const next = (highestIssued ?? 0) + 1;
  if (next > STOCK_CODE_MAX_NUMBER) {
    throw new StockCodeError(
      `${formatStockCodePrefix(prefix)} has used all ${STOCK_CODE_MAX_NUMBER} numbers`,
    );
  }
  return formatStockCode({ ...prefix, number: next });
}

/** The shared prefix of an existing code, or null when the code is malformed. */
export function stockCodePrefixOf(value: string): string | null {
  const parts = parseStockCode(value);
  if (!parts) return null;
  const { number: _number, ...prefix } = parts;
  return formatStockCodePrefix(prefix);
}
