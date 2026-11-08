/**
 * The LAX stock code: `LAX-{ORI|PRT}-{ARTIST}-{COLLECTION}-{YY}-{NNNN}`, for example
 * `LAX-ORI-MP-GAC-26-0037`. Staff already read and quote these, so the shape is fixed.
 *
 * - The artist code is 2 to 3 capital letters; the collection code is 2 to 4 capital letters or
 *   digits. Both are checked when LAX issues a code. Reading is lenient (1 to 6) so older codes
 *   still parse.
 * - YY is the registration year. The number runs per artist and collection across years: the year
 *   never restarts it.
 * - A print group mirrors its original (`LAX-ORI-MP-GAC-26-0037` is `LAX-PRT-MP-GAC-26-0037`).
 * - Older prints carry `PRI`. They still parse as prints; new print codes use `PRT`.
 * - LAX issues numbers; Zoho never does, so a code is never issued twice.
 */

export const STOCK_CODE_KINDS = ["original", "print"] as const;
export type StockCodeKind = (typeof STOCK_CODE_KINDS)[number];

const KIND_SEGMENT: Record<StockCodeKind, "ORI" | "PRT"> = { original: "ORI", print: "PRT" };
/** `PRI` is the segment older prints were issued with; it is read but never issued. */
const SEGMENT_KIND: Record<string, StockCodeKind> = { ORI: "original", PRT: "print", PRI: "print" };

export const STOCK_CODE_MAX_NUMBER = 9999;

const CODE_PART = "[A-Z0-9]{1,6}";
export const STOCK_CODE_PATTERN = new RegExp(
  `^LAX-(ORI|PRT|PRI)-(${CODE_PART})-(${CODE_PART})-(\\d{2})-(\\d{4})$`,
);

/** What LAX accepts when it issues a new code. */
export const ARTIST_CODE_PATTERN = /^[A-Z]{2,3}$/;
export const COLLECTION_CODE_PATTERN = /^[A-Z0-9]{2,4}$/;

export type StockCodeParts = {
  kind: StockCodeKind;
  /** The artist's code, for example MP. */
  artist: string;
  /** The collection code, for example GAC. */
  second: string;
  /** Two-digit year. */
  year: number;
  /** Running number within the artist and collection, 1 to 9999. */
  number: number;
};

export type StockCodePrefix = Omit<StockCodeParts, "number">;

/** What one run of numbers belongs to: the kind, the artist and the collection, in any year. */
export type StockCodeSeries = Pick<StockCodeParts, "kind" | "artist" | "second">;

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
  assertSeries(prefix);
  if (!Number.isInteger(prefix.year) || prefix.year < 0 || prefix.year > 99) {
    throw new StockCodeError(`Year ${prefix.year} must be a two-digit year`);
  }
}

/** Throws unless the artist and collection codes are ones LAX may issue new codes under. */
export function assertSeries(series: StockCodeSeries): void {
  if (!ARTIST_CODE_PATTERN.test(series.artist)) {
    throw new StockCodeError(`Artist code "${series.artist}" must be 2 to 3 capital letters`);
  }
  if (!COLLECTION_CODE_PATTERN.test(series.second)) {
    throw new StockCodeError(
      `Collection code "${series.second}" must be 2 to 4 capital letters or digits`,
    );
  }
}

/**
 * Which part of an existing code LAX would not issue today (artist or collection), or null when
 * both conform. For reporting legacy data; reading it is still allowed.
 */
export function nonConformingCodePart(value: string): "artist" | "collection" | null {
  const parts = parseStockCode(value);
  if (!parts) return null;
  if (!ARTIST_CODE_PATTERN.test(parts.artist)) return "artist";
  if (!COLLECTION_CODE_PATTERN.test(parts.second)) return "collection";
  return null;
}

export function formatStockCode(parts: StockCodeParts): string {
  if (!Number.isInteger(parts.number) || parts.number < 1 || parts.number > STOCK_CODE_MAX_NUMBER) {
    throw new StockCodeError(
      `Number ${parts.number} must be between 1 and ${STOCK_CODE_MAX_NUMBER}`,
    );
  }
  assertPrefix(parts);
  const year = String(parts.year).padStart(2, "0");
  const number = String(parts.number).padStart(4, "0");
  return `LAX-${KIND_SEGMENT[parts.kind]}-${parts.artist}-${parts.second}-${year}-${number}`;
}

/**
 * The next code for an artist and collection, given the highest number already issued for them in
 * any year (null when none). The year is only the registration year written into the code. Throws
 * when the run is full rather than reusing a number.
 */
export function nextStockCode(prefix: StockCodePrefix, highestIssued: number | null): string {
  const next = (highestIssued ?? 0) + 1;
  if (next > STOCK_CODE_MAX_NUMBER) {
    throw new StockCodeError(
      `${prefix.artist}-${prefix.second} has used all ${STOCK_CODE_MAX_NUMBER} numbers`,
    );
  }
  return formatStockCode({ ...prefix, number: next });
}

/**
 * The print group code for an original: same artist, collection, year and number, kind print
 * (`LAX-ORI-MP-GAC-26-0037` gives `LAX-PRT-MP-GAC-26-0037`). Throws when the code is not an
 * original's.
 */
export function printCodeForOriginal(originalCode: string): string {
  const parts = parseStockCode(originalCode);
  if (!parts || parts.kind !== "original") {
    throw new StockCodeError(`"${originalCode}" is not an original's stock code`);
  }
  return formatStockCode({ ...parts, kind: "print" });
}
