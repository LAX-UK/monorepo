import type { PrintGroupFacts } from "./print-group-facts.js";

/** The fields LAX fills on a Print_Products record, keyed by Zoho's API names. */
export type PrintProductFields = {
  Print_Group_ID: string;
  Total_Edition_Quantity: number;
  Collector_Allocation: number;
  Artist_Allocation: number;
  LAX_Allocation: number;
  Edition_Type: "Numbered" | "Open" | null;
  /** The original's Zoho Product; null when the original has none. */
  Linked_Original_Artwork: string | null;
};

/** The fields LAX fills on an Edition_Ledgers record: one counter record per group. */
export type EditionLedgerFields = {
  LAX_Mirror_Key: string;
  /** The Print_Products record the ledger counts. */
  Linked_Print_Product_Group: string;
  Total_Edition: number;
  Assigned_To_Client: number;
  Assigned_To_Artist: number;
  Assigned_To_LAX: number;
};

/** What Zoho holds now for a group; absent records are null. */
export type ZohoPrintGroupState = {
  printProduct: { id: string; fields: Partial<PrintProductFields> } | null;
  ledger: { id: string; fields: Partial<EditionLedgerFields> } | null;
};

export function wantedPrintProduct(code: string, facts: PrintGroupFacts): PrintProductFields {
  return {
    Print_Group_ID: code,
    Total_Edition_Quantity: facts.total,
    Collector_Allocation: facts.collector,
    Artist_Allocation: facts.artist,
    LAX_Allocation: facts.lax,
    Edition_Type: facts.editionType,
    Linked_Original_Artwork: facts.original?.zohoProductId ?? null,
  };
}

export function ledgerMirrorKey(code: string): string {
  return `group:${code}`;
}

export function wantedLedger(
  code: string,
  facts: PrintGroupFacts,
  printProductId: string,
): EditionLedgerFields {
  return {
    LAX_Mirror_Key: ledgerMirrorKey(code),
    Linked_Print_Product_Group: printProductId,
    Total_Edition: facts.total,
    Assigned_To_Client: facts.collector,
    Assigned_To_Artist: facts.artist,
    Assigned_To_LAX: facts.lax,
  };
}

/** The wanted fields that differ from what Zoho holds; empty when Zoho already agrees. */
export function differingFields<T extends Record<string, unknown>>(
  wanted: T,
  current: Partial<T> | null,
): Partial<T> {
  const changed: Partial<T> = {};
  for (const key of Object.keys(wanted) as (keyof T)[]) {
    // A field LAX has no value for is left alone rather than blanked in Zoho.
    if (wanted[key] === null) continue;
    if (current?.[key] !== wanted[key]) changed[key] = wanted[key];
  }
  return changed;
}

/** The Print_Products write, or null when the record already agrees. */
export function planPrintProduct(
  code: string,
  facts: PrintGroupFacts,
  zoho: ZohoPrintGroupState,
): PrintProductFields | null {
  const wanted = wantedPrintProduct(code, facts);
  const changed = differingFields(wanted, zoho.printProduct?.fields ?? null);
  return Object.keys(changed).length > 0 ? wanted : null;
}

/** The Edition_Ledgers write, or null when the record already agrees. */
export function planLedger(
  code: string,
  facts: PrintGroupFacts,
  zoho: ZohoPrintGroupState,
  printProductId: string,
): EditionLedgerFields | null {
  const wanted = wantedLedger(code, facts, printProductId);
  const changed = differingFields(wanted, zoho.ledger?.fields ?? null);
  return Object.keys(changed).length > 0 ? wanted : null;
}
