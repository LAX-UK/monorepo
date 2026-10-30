import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { parseBidsListQuery } from "./bids-list";
import { bidsExportHref, csvCell, myBidsCsv, myBidsCsvFilename } from "./my-bids-csv";

describe("myBidsCsv", () => {
  it("writes one row per lot with plain amounts, who placed it and the maximum", () => {
    const lot = {
      id: "lot-14",
      saleId: "sale-3",
      lotNumber: 14,
      title: "Still life, with jug",
      currentPrice: "4200",
      endTime: new Date("2026-11-02T16:04:00.000Z"),
    } as Lot;
    const csv = myBidsCsv(
      [
        {
          status: "outbid",
          row: {
            lot,
            placedBy: { userId: "u-2", name: "Tom Whitfield" },
            bid: {
              id: "b1",
              lotId: "lot-14",
              amount: "3800",
              maxAutoBidAmount: "4000",
              isWinning: false,
              isAutoBid: true,
              placedVia: "web",
              createdAt: new Date(),
            },
          },
        },
      ],
      { "sale-3": "Autumn modern and contemporary" },
    );
    expect(csv.split("\n")).toEqual([
      "lot_number,title,sale,status,placed_by,current_or_final_price,hammer_price,your_maximum,closes_at,placed_via,lot_id",
      '14,"Still life, with jug",Autumn modern and contemporary,Outbid,Tom Whitfield,4200,,4000,2026-11-02T16:04:00.000Z,web,lot-14',
      "",
    ]);
  });

  it("stops spreadsheet formulas and names the file by what it holds and the day", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(myBidsCsvFilename("won", new Date("2026-11-02T10:00:00Z"))).toBe(
      "lax-bids-won-2026-11-02.csv",
    );
  });

  it("asks for the view and filters on screen, with the period", () => {
    const query = parseBidsListQuery({ tab: "won", sale: "s-1", q: "jug" });
    expect(bidsExportHref(query, { scope: "view", from: "2026-01-01", to: "2026-10-30" })).toBe(
      "/bids/export?tab=won&q=jug&sale=s-1&scope=view&from=2026-01-01&to=2026-10-30",
    );
  });
});
