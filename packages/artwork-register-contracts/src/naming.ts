import { LONDON_TIME_ZONE, dayKey } from "@auction/datetime";
/**
 * LAX naming conventions for Zoho CRM deals and generated documents.
 *
 * Deal:     `<Client> — <Artist code> — <Stock no> — <Deal type> — <YYYY-MM>`
 * Document: `<Doc type> — <Client> — <Stock/SKU or order ref> — <YYYY-MM-DD>`
 *
 * The separator is an em dash with a space either side. Dates are London calendar dates, so a sale
 * made at 00:30 BST on 1 March is March, not February. A part that is not known is left out with
 * its separator; the formatters never print "undefined" or an email address.
 */
import { parseStockCode } from "./stock-code.js";

export const DEAL_TYPES = [
  "Acquisition",
  "Part-Exchange",
  "Print Order",
  "Commission / Placement",
  "Auction Consignment",
] as const;
export type DealType = (typeof DEAL_TYPES)[number];

export const DOCUMENT_TYPES = [
  "Invoice",
  "Paid Invoice",
  "Letter of Provenance",
  "Certificate of Authenticity",
  "Artwork Acquisition Agreement",
  "Part-Exchange Agreement",
  "Royalty Rights Agreement",
  "Price Protection Agreement",
  "Dispatch Confirmation",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

const SEPARATOR = " — ";
/** Zoho's Deal_Name limit. */
const DEAL_NAME_MAX = 255;

/** One line of text: control characters and runs of whitespace collapse. */
function oneLine(value: string): string {
  return (
    value
      // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** A part of a name: one line, and em dashes inside it become hyphens so they stay separators. */
function cleanPart(value: string | null | undefined): string | null {
  if (!value) return null;
  return oneLine(value.replace(/[—–]/g, "-")) || null;
}

/**
 * The client part: the organisation's name when the client is an organisation, otherwise the
 * person's surname (the last word of their name). An email address is never used: a value
 * containing "@" is treated as no name.
 */
export function clientLabel(input: {
  organisation?: string | null | undefined;
  personName?: string | null | undefined;
}): string | null {
  const organisation = cleanPart(input.organisation);
  if (organisation && !organisation.includes("@")) return organisation;
  const person = cleanPart(input.personName);
  if (!person || person.includes("@")) return null;
  return person.split(" ").at(-1) ?? null;
}

function londonParts(date: Date): { year: string; month: string; day: string } {
  const [year = "", month = "", day = ""] = dayKey(date, LONDON_TIME_ZONE).split("-");
  return { year, month, day };
}

/** `2026-03` for the London month of the instant. */
export function londonYearMonth(date: Date): string {
  const { year, month } = londonParts(date);
  return `${year}-${month}`;
}

/** `2026-03-01` for the London day of the instant. */
export function londonIsoDate(date: Date): string {
  const { year, month, day } = londonParts(date);
  return `${year}-${month}-${day}`;
}

export type DealNameInput = {
  /** Surname or organisation, from {@link clientLabel}. */
  client?: string | null | undefined;
  /** The artwork's register stock code, when it has one. The artist code is read from it. */
  stockCode?: string | null | undefined;
  /** The LAX lot or order reference, used as the stock number when there is no stock code. */
  reference?: string | null | undefined;
  dealType: DealType;
  /** When the deal event happened. */
  at: Date;
  /**
   * Further works in the same deal beyond the one named, for an order with several lines. The
   * deal is named after the first line and shows " +N".
   */
  additionalWorks?: number | undefined;
};

/**
 * The CRM deal name. The artist code is the one inside a valid stock code and is left out when
 * the work has none. The stock number is the stock code, else the reference. A multi-line order is
 * one deal named after its first line with " +N" for the others.
 */
export function formatDealName(input: DealNameInput): string {
  const stockCode = cleanPart(input.stockCode);
  const parsed = stockCode ? parseStockCode(stockCode) : null;
  const stockNo = stockCode ?? cleanPart(input.reference);
  const extra =
    input.additionalWorks && input.additionalWorks > 0
      ? ` +${Math.floor(input.additionalWorks)}`
      : "";
  const parts = [
    cleanPart(input.client),
    parsed?.artist ?? null,
    stockNo ? `${stockNo}${extra}` : null,
    input.dealType,
    londonYearMonth(input.at),
  ].filter((part): part is string => part !== null);
  return parts.join(SEPARATOR).slice(0, DEAL_NAME_MAX);
}

export type DocumentNameInput = {
  docType: DocumentType;
  client?: string | null | undefined;
  /** Stock code, SKU or order reference. */
  reference?: string | null | undefined;
  at: Date;
};

/** `Paid Invoice — Mears — LAX-S-10482 — 2026-02-14`, without the extension. */
export function formatDocumentName(input: DocumentNameInput): string {
  return [
    input.docType,
    cleanPart(input.client),
    cleanPart(input.reference),
    londonIsoDate(input.at),
  ]
    .filter((part): part is string => part !== null)
    .join(SEPARATOR);
}

const UNSAFE_FILE_CHARS = /[/\\:*?"<>|%]/g;

/** A name with no path separators or characters browsers and file systems reject. */
export function safeFileName(name: string): string {
  return (oneLine(name.replace(UNSAFE_FILE_CHARS, "-")) || "document").slice(0, 200);
}

/** The name of a generated document file: the document name made safe, plus the extension. */
export function formatDocumentFileName(input: DocumentNameInput, extension = "pdf"): string {
  return `${safeFileName(formatDocumentName(input))}.${extension}`;
}

function asciiFallback(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[—–]/g, "-")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\;]/g, "_");
}

function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * A `Content-Disposition: attachment` value for a file name that may hold an em dash or accented
 * letters: an ASCII `filename=` for old clients and the exact name in `filename*=` (RFC 5987).
 */
export function attachmentContentDisposition(fileName: string): string {
  const safe = safeFileName(fileName);
  return `attachment; filename="${asciiFallback(safe)}"; filename*=UTF-8''${encodeRfc5987(safe)}`;
}
