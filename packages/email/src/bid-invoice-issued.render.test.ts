import { describe, expect, it } from "vitest";
import { storedEmailAttachments } from "./attachments.js";
import { emailProductFor } from "./email-product.js";
import { renderEmail } from "./render.js";
import type { TemplateVarsByName } from "./types.js";

const vars: TemplateVarsByName["bid-invoice-issued"] = {
  userName: "Maya",
  invoiceNumber: "INV-000123",
  lotTitle: "Lot 12 · Harbour at dusk",
  total: "£1,543.20",
  settlement: { kind: "paid", on: "Thu 12 Nov, 14:05 GMT" },
  storedAttachment: {
    storageKey: "accounting/london_auction_xchange/9f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f.pdf",
    filename: "invoice-INV-000123.pdf",
    contentType: "application/pdf",
  },
  purchaseUrl: "https://lax.bid/purchases/0b6a4f8e-3c41-4c55-9d7e-1f0e2a3b4c5d",
};

describe("bid-invoice-issued", () => {
  it("says what is attached, the total and when it was paid, under the Books number", async () => {
    const { subject, text } = await renderEmail("bid-invoice-issued", vars);
    expect(subject).toBe("Your invoice INV-000123 from LAX Bid");
    expect(text).toContain(
      "Your invoice for Lot 12 · Harbour at dusk is attached. Total £1,543.20. Paid on Thu 12 Nov, 14:05 GMT.",
    );
  });

  it("says when it is due while it is owed", async () => {
    const { text } = await renderEmail("bid-invoice-issued", {
      ...vars,
      settlement: { kind: "due", by: "Thu 26 Nov, 23:59 GMT" },
    });
    expect(text).toContain("Total £1,543.20. Due by Thu 26 Nov, 23:59 GMT.");
    expect(text).not.toContain("Paid on");
  });

  it("is LAX Bid mail and carries the stored copy by its key, not its bytes", () => {
    expect(emailProductFor("bid-invoice-issued", vars)).toBe("bid");
    expect(storedEmailAttachments("bid-invoice-issued", vars)).toEqual([vars.storedAttachment]);
  });

  it("refuses an attachment key or name that is not plainly safe", () => {
    for (const storedAttachment of [
      { ...vars.storedAttachment, storageKey: "../secrets.pdf" },
      { ...vars.storedAttachment, filename: 'invoice".pdf' },
    ]) {
      expect(() =>
        storedEmailAttachments("bid-invoice-issued", { ...vars, storedAttachment }),
      ).toThrow("stored_email_attachment_invalid");
    }
  });
});
