import { describe, expect, it } from "vitest";
import { hangLot } from "./hang-fixtures";
import { pickHangLots } from "./hang-selection";

const lot = (id: string, currentPrice: string, extra = {}) =>
  hangLot({ id, currentPrice, startingPrice: "100.00", ...extra });

describe("pickHangLots", () => {
  it("puts staff's featured lots first, in staff order", () => {
    const lots = [lot("a", "900"), lot("b", "100"), lot("c", "500"), lot("d", "300")];
    expect(pickHangLots(lots, ["c", "a"]).map((l) => l.id)).toEqual(["c", "a"]);
  });

  it("falls back to the top lots by price when fewer than two are featured", () => {
    const lots = [lot("a", "300"), lot("b", "900"), lot("c", "500")];
    expect(pickHangLots(lots, []).map((l) => l.id)).toEqual(["b", "c", "a"]);
    expect(pickHangLots(lots, ["a"]).map((l) => l.id)).toEqual(["b", "c", "a"]);
  });

  it("skips featured lots without a photograph, or no longer in the sale", () => {
    const lots = [
      lot("a", "300"),
      lot("b", "900", { images: [], imageAssets: [] }),
      lot("c", "500"),
    ];
    expect(pickHangLots(lots, ["b", "missing", "c", "a"]).map((l) => l.id)).toEqual(["c", "a"]);
  });

  it("never includes a withdrawn lot or one without a photograph", () => {
    const lots = [
      lot("a", "300"),
      lot("gone", "900", { status: "cancelled" }),
      lot("bare", "800", { images: [], imageAssets: [] }),
    ];
    expect(pickHangLots(lots).map((l) => l.id)).toEqual(["a"]);
  });

  it("ranks an opening bid when there are no bids yet", () => {
    const lots = [lot("a", "0", { startingPrice: "2000.00" }), lot("b", "1500")];
    expect(pickHangLots(lots).map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("puts lots that did not sell last", () => {
    const sold = lot("sold", "200", { status: "ended", winnerId: "u1" });
    const unsold = lot("unsold", "9000", { status: "ended", winnerId: null });
    expect(pickHangLots([unsold, sold]).map((l) => l.id)).toEqual(["sold", "unsold"]);
  });

  it("holds twelve at most", () => {
    const lots = Array.from({ length: 20 }, (_, i) => lot(`l${i}`, String(1000 + i)));
    expect(pickHangLots(lots)).toHaveLength(12);
    expect(
      pickHangLots(
        lots,
        lots.map((l) => l.id),
      ),
    ).toHaveLength(12);
  });
});
