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
    expect(model.number).toBe("LAX-INV-000124");
    expect(model.orderReference).toBe("LAX-S-10482");
    expect(model.fileName).toBe("Paid Invoice — Thorne — LAX-S-10482 — 2026-10-01.pdf");
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

  it("shows no VAT breakdown when the order recorded no VAT, and notes refunds", () => {
    const model = buildOrderInvoiceModel({
      order: sampleOrderRecord({
        lines: [sampleOrderLine({ vatRateBp: null, vatPence: null })],
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

  it("refuses an order without an invoice number", () => {
    expect(() =>
      buildOrderInvoiceModel({
        order: sampleOrderRecord({ invoiceNumber: null }),
        customer,
        supplier,
        vatNumber: null,
      }),
    ).toThrow(/no invoice number/);
  });
});

describe("buildOrderInvoiceModel: the print on a line", () => {
  const rowDetail = (line: Parameters<typeof sampleOrderLine>[0]) =>
    buildOrderInvoiceModel({
      order: sampleOrderRecord({ lines: [sampleOrderLine(line)] }),
      customer,
      supplier,
      vatNumber: "GB123456789",
    }).rows[0]?.detail;

  it("describes the print as the buyer was told at payment", () => {
    expect(
      rowDetail({
        editionNumber: 7,
        editionInvoiceDetail:
          "Limited edition of 24, no. 7, signed by hand, with certificate of authenticity",
      }),
    ).toBe(
      "Emmett King · Limited edition of 24, no. 7, signed by hand, with certificate of authenticity",
    );
  });

  it("never prints a number for an unnumbered print", () => {
    expect(
      rowDetail({
        editionNumber: null,
        editionSize: null,
        editionInvoiceDetail: "Open edition, unsigned",
      }),
    ).toBe("Emmett King · Open edition, unsigned");
  });

  it("falls back to the plain edition when no facts were recorded", () => {
    expect(rowDetail({ editionNumber: 3, editionSize: 24 })).toBe("Emmett King · Edition 3 of 24");
  });

  it("is issued by London Art Exchange Ltd", () => {
    const model = buildOrderInvoiceModel({
      order: sampleOrderRecord(),
      customer,
      supplier,
      vatNumber: null,
    });
    expect(model.supplier[0]).toBe("London Art Exchange Ltd");
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

describe("invoice file name", () => {
  it("omits the client when the order has no name and never uses the email", () => {
    const model = buildOrderInvoiceModel({
      order: sampleOrderRecord({ deliveryAddress: null }),
      customer: { name: null, email: "robert@example.test" },
      supplier,
      vatNumber: null,
    });
    expect(model.fileName).toBe("Paid Invoice — LAX-S-10482 — 2026-10-01.pdf");
  });

  it("keeps accented surnames", () => {
    const model = buildOrderInvoiceModel({
      order: sampleOrderRecord(),
      customer: { name: "Zoë Léger", email: null },
      supplier,
      vatNumber: null,
    });
    expect(model.fileName).toBe("Paid Invoice — Léger — LAX-S-10482 — 2026-10-01.pdf");
  });
});

describe("delivery country on the invoice", () => {
  it("prints the country's name for an address outside the UK", () => {
    const model = buildOrderInvoiceModel({
      order: sampleOrderRecord({
        deliveryAddress: {
          recipientName: "Anna Weber",
          line1: "Friedrichstrasse 12",
          city: "Berlin",
          postcode: "10117",
          country: "DE",
        },
      }),
      customer,
      supplier,
      vatNumber: null,
    });
    expect(model.deliverTo).toContain("Germany");
    expect(model.deliverTo).not.toContain("DE");
  });
});

describe("buildOrderInvoiceModel: framing", () => {
  it("shows a frame as its own row at its own VAT, apart from the print it frames", () => {
    const model = buildOrderInvoiceModel({
      order: sampleOrderRecord({
        merchandiseSubtotalPence: 12_000,
        framingSubtotalPence: 21_000,
        totalPence: 34_500,
        lines: [
          sampleOrderLine({ editionNumber: 3, editionSize: 24 }),
          sampleOrderLine({
            orderLineId: "550e8400-e29b-41d4-a716-846655440003",
            kind: "framing",
            framingName: "Natural oak frame",
            framingFor: "Warm Basket, no. 3",
            framingDetail: "Window mount, white conservation board · UV-filtering acrylic",
            artworkTitle: null,
            artworkSlug: null,
            artistName: null,
            editionSize: null,
            unitPricePence: 21_000,
            vatRateBp: 2000,
            vatPence: 3500,
          }),
        ],
      }),
      customer,
      supplier,
      vatNumber: "GB123456789",
    });
    expect(model.rows.map((row) => [row.description, row.detail, row.amount])).toEqual([
      ["Warm Basket", expect.stringContaining("Edition 3 of 24"), "£120.00"],
      [
        "Framing for Warm Basket, no. 3",
        "Natural oak frame · Window mount, white conservation board · UV-filtering acrylic",
        "£210.00",
      ],
      ["UK insured delivery", null, "£15.00"],
    ]);
  });
});
