import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { csvCell, myBidsCsv, myBidsCsvFilename } from "./my-bids-csv";
import type { MyBidCardVm } from "./my-bids.vm";
import { filterMyBidCards, showsMyBidsSearch } from "./my-bids.vm";

describe("myBidsCsv", () => {
  it("writes one row per lot with plain amounts and the person's maximum", () => {
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
      "lot_number,title,sale,status,current_price,your_maximum,closes_at,placed_via,lot_id",
      '14,"Still life, with jug",Autumn modern and contemporary,Outbid,4200,4000,2026-11-02T16:04:00.000Z,web,lot-14',
      "",
    ]);
  });

  it("stops spreadsheet formulas and names the file by view and day", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(myBidsCsvFilename("won", new Date("2026-11-02T10:00:00Z"))).toBe(
      "lax-bids-won-2026-11-02.csv",
    );
  });
});

describe("My bids search", () => {
  const card = (id: string, title: string, saleTitle: string | null): MyBidCardVm =>
    ({ id, title, lotLabel: `Lot ${id}`, saleTitle }) as MyBidCardVm;
  const cards = [
    card("14", "Still life with stoneware jug", "Autumn modern"),
    card("22", "The lute player", "Autumn modern"),
    card("8", "Gold wristwatch", "Important watches"),
  ];

  it("appears only when a view has more than eight lots", () => {
    expect(showsMyBidsSearch(8)).toBe(false);
    expect(showsMyBidsSearch(9)).toBe(true);
  });

  it("matches every word against the title, lot and sale", () => {
    expect(filterMyBidCards(cards, "autumn LUTE").map((c) => c.id)).toEqual(["22"]);
    expect(filterMyBidCards(cards, "lot 8").map((c) => c.id)).toEqual(["8"]);
    expect(filterMyBidCards(cards, "  ")).toHaveLength(3);
  });
});
