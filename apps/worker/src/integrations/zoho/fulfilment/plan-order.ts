import {
  type PrintAllocationCode,
  type PrintFrameCode,
  type PrintPaperCode,
  type PrintSizeCode,
  buildPrintSku,
  isPrintFrameCode,
  isPrintPaperCode,
  isPrintSizeCode,
} from "@auction/artwork-register-contracts";
import type { CrmFieldValue } from "../../crm/crm-gateway.js";
import type { DispatchFacts, PrintLineFacts, RunSales } from "./order-facts.js";

/** Fields to write, keyed by Zoho API name. A lookup is `{ id }`. */
export type ZohoFields = Record<string, CrmFieldValue>;

/** A record as Zoho holds it now: lookups read back as the bare id. */
export type ZohoRecordState = { id: string; fields: Record<string, unknown> };

export type PrintSku = {
  sku: string;
  size: PrintSizeCode;
  paper: PrintPaperCode;
  frame: PrintFrameCode;
  allocation: PrintAllocationCode;
};

export type SkuResult = { ok: true; value: PrintSku } | { ok: false; reason: string };

const ALLOCATION: Record<PrintLineFacts["allocation"], PrintAllocationCode> = {
  original_buyer_entitlement: "COL",
  artist: "ART",
  lax: "LAX",
};

/** The catalogue frames (shop_framing_option.frame) and the SKU code each is sold under. */
const FRAMING_FRAME: Record<string, PrintFrameCode> = {
  black_wood: "FRB",
  white_wood: "FRW",
  natural_oak: "FRN",
};

/** Paper names staff write, matched as words; one match only, or the paper is not known. */
const PAPER_NAMES: [RegExp, PrintPaperCode][] = [
  [/\bcotton\b/i, "COT"],
  [/\bbaryta\b/i, "BAR"],
  [/\bhahnem(u|ü|ue)hle\b/i, "HAH"],
  [/\bmunken\b/i, "MUN"],
];

/** "A3" or "A3 (29.7 × 42 cm)": the sheet's ISO size, when it leads the text. */
export function sizeCodeOf(text: string | null): PrintSizeCode | null {
  const lead = /^\s*(A\d)\b/i.exec(text ?? "")?.[1]?.toUpperCase();
  return lead && isPrintSizeCode(lead) ? lead : null;
}

/** The paper's code, written as the code itself or as one paper's name. */
export function paperCodeOf(text: string | null): PrintPaperCode | null {
  const value = (text ?? "").trim();
  if (isPrintPaperCode(value.toUpperCase())) return value.toUpperCase() as PrintPaperCode;
  const matches = PAPER_NAMES.filter(([pattern]) => pattern.test(value));
  return matches.length === 1 ? (matches[0] as [RegExp, PrintPaperCode])[1] : null;
}

/**
 * The frame the print leaves in: the catalogue frame sold with it, else the listing's frame code,
 * else unframed. An edition the artist framed is described in words, so it has no code to guess.
 */
export function frameCodeOf(line: PrintLineFacts): PrintFrameCode | null {
  if (line.framing && !line.framing.released) return FRAMING_FRAME[line.framing.frame] ?? null;
  const listed = (line.printFrame ?? "").trim().toUpperCase();
  if (isPrintFrameCode(listed)) return listed;
  if (line.framedByArtist) return null;
  return listed === "" || listed === "UNFRAMED" ? "UNF" : null;
}

/** The print's SKU in its group, or why it cannot be worked out. A SKU is never guessed. */
export function printSkuOf(line: PrintLineFacts, groupCode: string): SkuResult {
  const size = sizeCodeOf(line.printSize);
  if (!size) return { ok: false, reason: `print size "${line.printSize ?? ""}" has no SKU code` };
  const paper = paperCodeOf(line.printPaper);
  if (!paper) return { ok: false, reason: `paper "${line.printPaper ?? ""}" has no SKU code` };
  const frame = frameCodeOf(line);
  if (!frame) return { ok: false, reason: "the frame has no SKU code" };
  const allocation = ALLOCATION[line.allocation];
  const sku = buildPrintSku({ groupCode, size, paper, frame, allocation });
  if (!sku) return { ok: false, reason: `group code ${groupCode} is not a print code` };
  return { ok: true, value: { sku, size, paper, frame, allocation } };
}

export function wantedPrintSku(
  sku: PrintSku,
  line: PrintLineFacts,
  /** The group's Print_Products record; null only in a dry run before the group is mirrored. */
  printProductId: string | null,
): ZohoFields {
  return {
    SKU: sku.sku,
    Linked_Print_Product_Group: printProductId ? { id: printProductId } : null,
    Size: sku.size,
    Paper: sku.paper,
    Frame: sku.frame,
    Allocation_Bucket: sku.allocation,
    Edition_Type: line.editionType,
  };
}

/** Zoho's dispatch statuses in the order a parcel moves through them. */
const DISPATCH_RANK: Record<string, number> = {
  "Pack Prep": 1,
  Ready: 2,
  Dispatched: 3,
  "In Transit": 4,
  Delivered: 5,
};

/**
 * The dispatch status in Zoho, or null while there is nothing to dispatch: before any print is
 * picked, for an order kept in LAX storage, and for a cancelled fulfilment.
 */
export function dispatchStatusOf(
  fulfilment: DispatchFacts,
  anyPackConfirmed: boolean,
): string | null {
  switch (fulfilment.status) {
    case "pending_production":
    case "in_production":
      return anyPackConfirmed ? "Pack Prep" : null;
    case "awaiting_dispatch":
    case "ready_for_collection":
      return "Ready";
    case "in_transit":
      return "Dispatched";
    case "delivered":
    case "collected":
      return "Delivered";
    default:
      return null;
  }
}

export function ledgerCounts(sales: RunSales): ZohoFields {
  return {
    Assigned_To_Client: sales.collector,
    Assigned_To_Artist: sales.artist,
    Assigned_To_LAX: sales.lax,
  };
}

/** Zoho may read a number back as text, so values are compared as text. */
const sameValue = (wanted: CrmFieldValue, current: unknown): boolean => {
  if (current === null || current === undefined) return false;
  const value = typeof wanted === "object" && wanted !== null ? wanted.id : wanted;
  return String(value) === String(current);
};

/**
 * The fields to write so Zoho holds what LAX wants, or null when it already does. A field LAX has
 * no value for is left alone. A status is only ever moved forward: when Zoho's status is as far
 * along as LAX's or further (staff may move it on in Zoho), it is not written back.
 */
export function planWrite(
  wanted: ZohoFields,
  current: ZohoRecordState | null,
  status?: { field: string; rank: "dispatch" },
): ZohoFields | null {
  const changed: ZohoFields = {};
  for (const [key, value] of Object.entries(wanted)) {
    if (value === null) continue;
    if (!current || !sameValue(value, current.fields[key])) changed[key] = value;
  }
  if (status && current && status.field in changed) {
    const held = DISPATCH_RANK[String(current.fields[status.field])] ?? 0;
    if (held >= (DISPATCH_RANK[String(changed[status.field])] ?? 0)) delete changed[status.field];
  }
  return Object.keys(changed).length > 0 ? changed : null;
}
