import type { LegalEntityKind } from "./legal-entity.js";

/** Normalised “bill to” block for hosted invoices, email, and Xero ACCREC presentation. */
export type BillToContext = {
  kind: LegalEntityKind;
  /** Legal name (org) or user display name (individual). */
  billToName: string;
  /** Physical address lines for rendering; empty when data is missing (see `addressIncomplete`). */
  addressLines: string[];
  /** e.g. `VAT: GB123456789` — organisations only when `vat_number` is set. */
  vatLine: string | null;
  /** True when required address rows were missing (ops should investigate). */
  addressIncomplete: boolean;
};
