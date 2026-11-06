import { describe, expect, it } from "vitest";
import { receiptLineSummary } from "./drizzle-shop-notification.publisher.js";

describe("receiptLineSummary", () => {
  it("puts the edition facts the buyer was told beside the title", () => {
    expect(
      receiptLineSummary([
        {
          artworkTitle: "Harbour at dusk",
          editionDetail: "No. 7 of 24 · Hand-signed · Certificate from the artist",
          unitPricePence: 42000,
        },
      ]),
    ).toBe("Harbour at dusk (No. 7 of 24 · Hand-signed · Certificate from the artist) — £420.00");
  });

  it("leaves a merchandise line, or a print with nothing recorded, as title and price", () => {
    expect(
      receiptLineSummary([
        { artworkTitle: "Tote bag", editionDetail: null, unitPricePence: 2500 },
        { artworkTitle: "Open study", editionDetail: null, unitPricePence: 9500 },
      ]),
    ).toBe("Tote bag — £25.00\nOpen study — £95.00");
  });
});
