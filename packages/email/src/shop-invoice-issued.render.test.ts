import { describe, expect, it } from "vitest";
import { storedEmailAttachments } from "./attachments.js";
import { emailProductFor } from "./email-product.js";
import { renderEmail } from "./render.js";
import type { TemplateVarsByName } from "./types.js";

const vars: TemplateVarsByName["shop-invoice-issued"] = {
  userName: "Ada",
  invoiceNumber: "LAX-INV-000124",
  orderReference: "LAX-S-10482",
  total: "£595.00",
  paidOn: "Thu 12 Nov, 14:05 GMT",
  storedAttachment: {
    storageKey: "accounting/london_art_exchange/9f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f.pdf",
    filename: "invoice-LAX-INV-000124.pdf",
    contentType: "application/pdf",
  },
  orderUrl: "https://shop.lax.example/account/orders/0b6a4f8e-3c41-4c55-9d7e-1f0e2a3b4c5d",
};

describe("shop-invoice-issued", () => {
  it("is 'Your invoice [number] from LAX Shop', under the Shop's own number", async () => {
    const { subject, text, html } = await renderEmail("shop-invoice-issued", vars);
    expect(subject).toBe("Your invoice LAX-INV-000124 from LAX Shop");
    expect(text).toContain(
      "Your invoice for order LAX-S-10482 is attached. Total £595.00. Paid on Thu 12 Nov, 14:05 GMT.",
    );
    expect(text).toContain("Hi Ada,");
    expect(html).toContain(vars.orderUrl);
  });

  it("greets a buyer with no name plainly", async () => {
    const { text } = await renderEmail("shop-invoice-issued", { ...vars, userName: null });
    expect(text).toContain("Hi there,");
  });

  it("is LAX Shop mail and carries the stored copy by its key, not its bytes", () => {
    expect(emailProductFor("shop-invoice-issued", vars)).toBe("shop");
    expect(storedEmailAttachments("shop-invoice-issued", vars)).toEqual([vars.storedAttachment]);
  });

  it("refuses a stored file outside accounting/ or that is not a PDF", () => {
    for (const storedAttachment of [
      { ...vars.storedAttachment, storageKey: "../secrets.pdf" },
      { ...vars.storedAttachment, storageKey: "shop/uploads/id.pdf" },
      { ...vars.storedAttachment, storageKey: "accounting/london_art_exchange/doc.png" },
    ]) {
      expect(() =>
        storedEmailAttachments("shop-invoice-issued", { ...vars, storedAttachment }),
      ).toThrow("stored_email_attachment_invalid");
    }
  });

  it("does not let another Shop template carry a stored file", () => {
    const planted = { storedAttachment: vars.storedAttachment } as never;
    for (const template of ["shop-order-receipt", "shop-refund-issued"] as const) {
      expect(storedEmailAttachments(template, planted)).toEqual([]);
    }
  });
});
