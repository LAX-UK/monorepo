import { type AccountingQueueRow, accountingDocumentLabel } from "@auction/types";

/** One accounting document as the API sends it; override what a test is about. */
export function accountingRow(overrides: Partial<AccountingQueueRow> = {}): AccountingQueueRow {
  const row: AccountingQueueRow = {
    id: "5b0f3a50-1f43-4f63-9f2b-5e8f3f7f1a10",
    reference: "LAX-BID-INV-01hx3",
    documentType: "invoice",
    label: "Invoice · Bid",
    parked: null,
    appliedTo: [],
    product: "bid",
    organisation: "london_auction_xchange",
    state: "failed",
    targetMode: "test_org",
    grossPence: 15_000,
    attempts: 2,
    createdAt: "2026-11-10T09:00:00.000Z",
    updatedAt: "2026-11-11T09:30:00.000Z",
    problem: "A line carries VAT, but Books has no VAT rate set up for it.",
    problemCode: "zoho_books_mapping_no_tax_id",
    lockedPeriod: false,
    books: null,
    canTryAgain: true,
    ...overrides,
  };
  // The label follows the document unless a test names one, as the API words it.
  return overrides.label
    ? row
    : { ...row, label: accountingDocumentLabel(row.documentType, row.product, row.reference) };
}
