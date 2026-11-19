/** The Zoho Products field LAX writes the artwork's place into. Its values are a Zoho picklist. */
export const ZOHO_STATUS_FIELD = "Status";
/** The Zoho Products field LAX writes the stock code into. */
export const ZOHO_STOCK_CODE_FIELD = "Reference_Stock_Code";

/** What Zoho holds for a Product now, as far as the stock code writeback cares. */
export type ZohoProductState = {
  stockCode: string | null;
  /** When the Product was last modified, as read with the stock code; null when not known. */
  modifiedAt: Date | null;
};

/** The fields to send, or none when Zoho already holds the value. */
export type ZohoProductUpdate = {
  fields: Record<string, string>;
};

/** What to do with the stock code: nothing, send it, or leave Zoho's and tell staff. */
export type StockCodePlan =
  | { kind: "in_sync" }
  | { kind: "write"; update: ZohoProductUpdate }
  | { kind: "conflict"; zohoStockCode: string };

/**
 * Sends the stock code only where Zoho holds none. A stock code edited in Zoho is a conflict for
 * staff, never overwritten. LAX only ever writes the register's code, which LAX never changes once
 * issued (it takes Zoho's only when staff accept it), so a Zoho value equal to the code LAX last
 * wrote is the in-sync case.
 */
export function planStockCodeUpdate(stockCode: string, current: ZohoProductState): StockCodePlan {
  if (current.stockCode === stockCode) return { kind: "in_sync" };
  if (current.stockCode === null) {
    return { kind: "write", update: { fields: { [ZOHO_STOCK_CODE_FIELD]: stockCode } } };
  }
  return { kind: "conflict", zohoStockCode: current.stockCode };
}
