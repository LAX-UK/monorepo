import { describe, expect, it } from "vitest";
import type { DocumentRecord } from "./lifecycle.js";
import {
  INVOICE_DELAYED_AFTER_MS,
  type InvoiceStandingInput,
  invoiceStanding,
} from "./standing.js";

const RAISED = Date.parse("2026-11-12T14:05:00Z");
const REFERENCE = "LAX-BID-INV-0b6a4f8e-3c41-4c55-9d7e-1f0e2a3b4c5d";

const issued: DocumentRecord = {
  kind: "invoice",
  reference: REFERENCE,
  attempts: 1,
  status: "issued",
  issued: { number: "INV-000123", providerId: "4600000123", pdfRef: "/invoices/4600000123" },
};
const pending: DocumentRecord = {
  kind: "invoice",
  reference: REFERENCE,
  attempts: 0,
  status: "pending",
};

function input(patch: Partial<InvoiceStandingInput>): InvoiceStandingInput {
  return {
    raisedAtMs: RAISED,
    cancelledAtMs: null,
    booksMode: "live",
    document: null,
    ...patch,
  };
}

describe("invoiceStanding", () => {
  it("keeps LAX's own invoice while Books is not aimed at the product", () => {
    expect(invoiceStanding(input({ booksMode: null }), RAISED)).toEqual({ kind: "lax" });
  });

  it("never shows a rehearsal as a Books invoice, however long it has been", () => {
    const rehearsed = input({
      booksMode: "dry_run",
      document: { record: issued, copyStored: true },
    });
    expect(invoiceStanding(rehearsed, RAISED + 10 * INVOICE_DELAYED_AFTER_MS)).toEqual({
      kind: "lax",
    });
  });

  it("is being prepared until Books issued it and the copy is stored", () => {
    expect(invoiceStanding(input({}), RAISED)).toEqual({ kind: "preparing" });
    expect(
      invoiceStanding(input({ document: { record: pending, copyStored: false } }), RAISED + 1),
    ).toEqual({ kind: "preparing" });
    // Issued, but LAX has no copy of the PDF yet: there is nothing to download.
    expect(
      invoiceStanding(input({ document: { record: issued, copyStored: false } }), RAISED + 1),
    ).toEqual({ kind: "preparing" });
  });

  it("is late after 30 minutes, not at 30 minutes", () => {
    const waiting = input({
      booksMode: "test_org",
      document: { record: pending, copyStored: false },
    });
    expect(invoiceStanding(waiting, RAISED + INVOICE_DELAYED_AFTER_MS)).toEqual({
      kind: "preparing",
    });
    expect(invoiceStanding(waiting, RAISED + INVOICE_DELAYED_AFTER_MS + 1)).toEqual({
      kind: "delayed",
    });
  });

  it("is issued under the Books number once the copy is stored", () => {
    const done = input({ document: { record: issued, copyStored: true } });
    expect(invoiceStanding(done, RAISED + 2 * INVOICE_DELAYED_AFTER_MS)).toEqual({
      kind: "issued",
      number: "INV-000123",
    });
  });

  it("says cancelled whatever Books holds", () => {
    const cancelledAtMs = RAISED + 1_000;
    const cancelled = input({ cancelledAtMs, document: { record: issued, copyStored: true } });
    expect(invoiceStanding(cancelled, RAISED)).toEqual({ kind: "cancelled", cancelledAtMs });
    expect(invoiceStanding({ ...cancelled, booksMode: null }, RAISED)).toEqual({
      kind: "cancelled",
      cancelledAtMs,
    });
  });
});
