/**
 * The print SKU: `{print group code}-{SIZE}-{PAPER}-{FRAME}-{ALLOC}`, for example
 * `LAX-PRT-MP-GAC-26-0037-A3-COT-FRB-ART`.
 *
 * Each part is a closed set of codes. Free text that does not map to a code gives null: a SKU is
 * never guessed.
 */

import { parseStockCode } from "./stock-code.js";

export const PRINT_SIZE_CODES = ["A4", "A3", "A2", "A1"] as const;
export const PRINT_PAPER_CODES = ["COT", "BAR", "HAH", "MUN"] as const;
export const PRINT_FRAME_CODES = ["UNF", "FRB", "FRW", "FRN"] as const;
/** Who the print is allocated to, which decides royalty treatment. */
export const PRINT_ALLOCATION_CODES = ["ART", "COL", "LAX"] as const;

export type PrintSizeCode = (typeof PRINT_SIZE_CODES)[number];
export type PrintPaperCode = (typeof PRINT_PAPER_CODES)[number];
export type PrintFrameCode = (typeof PRINT_FRAME_CODES)[number];
export type PrintAllocationCode = (typeof PRINT_ALLOCATION_CODES)[number];

export type PrintSkuParts = {
  /** The print group's stock code, for example `LAX-PRT-MP-GAC-26-0037`. */
  groupCode: string;
  size: PrintSizeCode;
  paper: PrintPaperCode;
  frame: PrintFrameCode;
  allocation: PrintAllocationCode;
};

function isOneOf<T extends string>(codes: readonly T[], value: string): value is T {
  return (codes as readonly string[]).includes(value);
}

export const isPrintSizeCode = (value: string): value is PrintSizeCode =>
  isOneOf(PRINT_SIZE_CODES, value);
export const isPrintPaperCode = (value: string): value is PrintPaperCode =>
  isOneOf(PRINT_PAPER_CODES, value);
export const isPrintFrameCode = (value: string): value is PrintFrameCode =>
  isOneOf(PRINT_FRAME_CODES, value);
export const isPrintAllocationCode = (value: string): value is PrintAllocationCode =>
  isOneOf(PRINT_ALLOCATION_CODES, value);

/**
 * The SKU for a print, or null when the group code is not a print stock code or any part is not
 * an allowed code. Legacy `PRI` group codes are read and written as `PRT`.
 */
export function buildPrintSku(parts: {
  groupCode: string;
  size: string;
  paper: string;
  frame: string;
  allocation: string;
}): string | null {
  const group = parseStockCode(parts.groupCode);
  if (!group || group.kind !== "print") return null;
  if (!isPrintSizeCode(parts.size)) return null;
  if (!isPrintPaperCode(parts.paper)) return null;
  if (!isPrintFrameCode(parts.frame)) return null;
  if (!isPrintAllocationCode(parts.allocation)) return null;
  const year = String(group.year).padStart(2, "0");
  const number = String(group.number).padStart(4, "0");
  return `LAX-PRT-${group.artist}-${group.second}-${year}-${number}-${parts.size}-${parts.paper}-${parts.frame}-${parts.allocation}`;
}

const SKU_PATTERN = new RegExp(
  `^(LAX-PRT-[A-Z0-9]{1,6}-[A-Z0-9]{1,6}-\\d{2}-\\d{4})-(${PRINT_SIZE_CODES.join("|")})-(${PRINT_PAPER_CODES.join("|")})-(${PRINT_FRAME_CODES.join("|")})-(${PRINT_ALLOCATION_CODES.join("|")})$`,
);

/** Reads a SKU back into its parts, or null when it is not in the print SKU shape. */
export function parsePrintSku(value: string): PrintSkuParts | null {
  const match = SKU_PATTERN.exec(value);
  if (!match) return null;
  const [, groupCode, size, paper, frame, allocation] = match;
  if (!parseStockCode(groupCode as string)) return null;
  return {
    groupCode: groupCode as string,
    size: size as PrintSizeCode,
    paper: paper as PrintPaperCode,
    frame: frame as PrintFrameCode,
    allocation: allocation as PrintAllocationCode,
  };
}

/**
 * The edition label set at fulfilment, for example `ED 07/25`: the print's number over the run
 * size, each as two digits. Null when either is not a whole number from 1 to 99, or the number is
 * past the run size.
 */
export function formatEditionLabel(editionNumber: number, runSize: number): string | null {
  const whole = (n: number) => Number.isInteger(n) && n >= 1 && n <= 99;
  if (!whole(editionNumber) || !whole(runSize) || editionNumber > runSize) return null;
  const two = (n: number) => String(n).padStart(2, "0");
  return `ED ${two(editionNumber)}/${two(runSize)}`;
}
