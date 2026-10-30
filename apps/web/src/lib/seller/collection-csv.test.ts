import { describe, expect, it } from "vitest";
import { collectionCsv } from "./collection-csv";
import type { CollectionWork } from "./collection-works";

const work: CollectionWork = {
  key: "lot:l1",
  kind: "bought",
  title: "Low cloud, Rye",
  image: null,
  meta: [],
  price: "£4,000.00",
  boughtFor: "£4,960.00",
  reference: "Lot 44",
  where: { label: "Delivered", tone: "success", shape: "check" },
  consignHref: "/selling/new?fromLot=l1",
  consignLabel: "Consign this work",
  canConsign: true,
  href: "/purchases/l1",
  at: Date.parse("2026-10-22T18:00:00Z"),
};

describe("collectionCsv", () => {
  it("adds what was paid only for members who see money", () => {
    expect(collectionCsv([work], { showPrice: true })).toBe(
      'title,reference,acquired,where_it_is,bought_for\nLow cloud,Rye,Lot 44,2026-10-22,Delivered,"£4,960.00"\n'.replace(
        "Low cloud,Rye",
        '"Low cloud, Rye"',
      ),
    );
    expect(collectionCsv([work], { showPrice: false })).toBe(
      'title,reference,acquired,where_it_is\n"Low cloud, Rye",Lot 44,2026-10-22,Delivered\n',
    );
  });
});
