import { legalEntityFor } from "@auction/branding";
import { describe, expect, it } from "vitest";
import { sampleOrderLine, sampleOrderRecord } from "../test-support/order-record.fixture.js";
import { buildOrderInvoiceModel, renderOrderInvoicePdf } from "./order-invoice.js";

const supplier = legalEntityFor("shop");
const customer = { name: "Robert Thorne", email: "robert@example.test" };

describe("buildOrderInvoiceModel", () => {
  it("is a VAT invoice numbered by the order reference once the supplier has a VAT number", () => {
    const model = buildOrderInvoiceModel({
      order: sampleOrderRecord({
        lines: [sampleOrderLine({ editionNumber: 3, editionSize: 24 })],
      }),
      customer,
      supplier,
      vatNumber: "GB123456789",
    });
    expect(model.title).toBe("VAT invoice");
    expect(model.number).toBe("LAX-S-10482");
    expect(model.fileName).toBe("LAX-S-10482-invoice.pdf");
    expect(model.issuedOn).toBe("1 Oct 2026");
    expect(model.supplier).toContain("London Art Exchange Ltd");
    expect(model.supplier).toContain("VAT number GB123456789");
    expect(model.customer).toEqual(["Robert Thorne", "robert@example.test"]);
    expect(model.deliverTo).toEqual([
      "Robert Thorne",
      "12 Elm Row",
      "Edinburgh EH7 4AA",
      "United Kingdom",
    ]);
    expect(model.rows[0]).toEqual({
      description: "Warm Basket",
      detail: "Emmett King · Edition 3 of 24",
      vatRate: "20%",
      amount: "£120.00",
    });
    expect(model.rows[1]).toMatchObject({ description: "UK insured delivery", amount: "£15.00" });
    expect(model.totals).toEqual([
      { label: "Total excluding VAT", value: "£112.50" },
      { label: "VAT at 20%", value: "£22.50" },
      { label: "Total paid", value: "£135.00", emphasis: true },
    ]);
  });

  it("is titled plainly while no VAT number is configured", () => {
    const model = buildOrderInvoiceModel({
      order: sampleOrderRecord(),
      customer,
      supplier,
      vatNumber: null,
    });
    expect(model.title).toBe("Invoice");
    expect(model.supplier.some((line) => line.startsWith("VAT number"))).toBe(false);
  });

  it("shows no VAT breakdown when the order recorded no rate, and notes refunds", () => {
    const model = buildOrderInvoiceModel({
      order: sampleOrderRecord({
        lines: [sampleOrderLine({ vatRateBp: null })],
        refunds: [
          {
            amountPence: 4000,
            source: "admin",
            status: "succeeded",
            requestedAt: new Date("2026-10-06T09:00:00.000Z"),
            refundedAt: new Date("2026-10-07T09:00:00.000Z"),
          },
        ],
      }),
      customer,
      supplier,
      vatNumber: "GB123456789",
    });
    expect(model.title).toBe("Invoice");
    expect(model.totals).toEqual([{ label: "Total paid", value: "£135.00", emphasis: true }]);
    expect(model.notes).toContain(
      "£40.00 was refunded on 7 Oct 2026 to the original payment method.",
    );
  });
});

describe("renderOrderInvoicePdf", () => {
  it("draws a PDF with the invoice number and totals", async () => {
    const model = buildOrderInvoiceModel({
      order: sampleOrderRecord(),
      customer,
      supplier,
      vatNumber: null,
    });
    const pdf = await renderOrderInvoicePdf(model, { compress: false });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
