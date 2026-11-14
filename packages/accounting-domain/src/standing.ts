import type { DocumentRecord } from "./lifecycle.js";
import type { TargetMode } from "./source-switch.js";

/**
 * How long a buyer's invoice may be "being prepared" before it counts as late: the card says so
 * and the Accounting alert is raised. Measured from when LAX raised the invoice.
 */
export const INVOICE_DELAYED_AFTER_MS = 30 * 60_000;

/** The books' copy of one raised invoice, as the buyer may be told about it. */
export interface InvoiceStandingInput {
  /** When LAX raised the invoice (epoch ms); the delay is measured from here. */
  readonly raisedAtMs: number;
  /** When the invoice was cancelled (epoch ms), or null while it stands. */
  readonly cancelledAtMs: number | null;
  /** The mode the switch aims this product's new documents at in Books, or null when Books is not aimed. */
  readonly booksMode: TargetMode | null;
  /** The invoice document held for that mode, or null when none is registered yet. */
  readonly document: {
    readonly record: DocumentRecord;
    /** LAX holds its own copy of the PDF the provider made. */
    readonly copyStored: boolean;
  } | null;
}

/**
 * - `lax`: Books does not issue this invoice to the buyer (it is not aimed at Books, only
 *   rehearses it, or issues it in the test organisation, whose documents are not tax invoices), so
 *   the buyer has LAX's own invoice exactly as before (a cancelled one too). Neither a rehearsal
 *   nor a test organisation ever shows a buyer a Books number.
 * - `preparing` / `delayed`: Books issues it live, and it is not issued with a stored copy yet;
 *   `delayed` once that has taken longer than `INVOICE_DELAYED_AFTER_MS`.
 * - `issued`: in Books (live) under its number, and LAX holds the PDF the buyer downloads.
 * - `cancelled`: the invoice was cancelled (Books issuing live); it is owed no more.
 */
export type InvoiceStanding =
  | { readonly kind: "lax" }
  | { readonly kind: "preparing" }
  | { readonly kind: "delayed" }
  | { readonly kind: "issued"; readonly number: string }
  | { readonly kind: "cancelled"; readonly cancelledAtMs: number };

/**
 * Where the buyer's invoice stands. Pure: the caller reads the rows and passes the time in. A
 * number is only ever shown once the provider issued the document live and its PDF is stored:
 * never from a dry run (its number is `DRY-RUN`) or the test organisation.
 */
export function invoiceStanding(input: InvoiceStandingInput, nowMs: number): InvoiceStanding {
  // Books off, only rehearsing, or aimed at the test organisation: the buyer's page is exactly
  // as it was before Books.
  if (input.booksMode !== "live") return { kind: "lax" };
  if (input.cancelledAtMs !== null) {
    return { kind: "cancelled", cancelledAtMs: input.cancelledAtMs };
  }
  const record = input.document?.record;
  if (record?.status === "issued" && input.document?.copyStored) {
    return { kind: "issued", number: record.issued.number };
  }
  return nowMs - input.raisedAtMs > INVOICE_DELAYED_AFTER_MS
    ? { kind: "delayed" }
    : { kind: "preparing" };
}
