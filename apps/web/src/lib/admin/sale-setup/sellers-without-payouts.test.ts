import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buildSaleSetupReadiness } from "./readiness";
import { nameSellersWithoutPayouts, sellerPayoutsItem } from "./sellers-without-payouts";

const lots = [
  { id: "l1", title: "Blue", sellerLegalEntityId: "s1" },
  { id: "l2", title: "Red", sellerLegalEntityId: "s1" },
  { id: "l3", title: "Green", sellerLegalEntityId: "s2" },
];

describe("nameSellersWithoutPayouts", () => {
  it("names each seller holding the sale back, once", async () => {
    const sellers = await nameSellersWithoutPayouts(
      lots,
      { l1: true, l2: true, l3: false },
      async (id) => (id === "s1" ? "Jane Smith" : null),
    );
    expect(sellers).toEqual([
      {
        sellerLegalEntityId: "s1",
        displayName: "Jane Smith",
        lots: [
          { id: "l1", title: "Blue" },
          { id: "l2", title: "Red" },
        ],
      },
    ]);
    expect(sellerPayoutsItem(sellers[0] as (typeof sellers)[number])).toEqual({
      id: "payouts:s1",
      label: "Jane Smith has not set up payouts (2 lots)",
      ok: false,
      severity: "required",
      href: "/admin/legal-entities/s1",
    });
  });

  it("falls back to a plain name", async () => {
    const [seller] = await nameSellersWithoutPayouts(lots, { l3: true }, async () => null);
    expect(seller?.displayName).toBe("A seller");
  });
});

describe("sale readiness with sellers without payouts", () => {
  const sale = {
    id: "sale-1",
    status: "draft",
    deliveryMode: "online",
    startTime: new Date(Date.now() + 7 * 86_400_000),
    endTime: new Date(Date.now() + 8 * 86_400_000),
    title: "Modern British",
  } as Sale;
  const lot = (id: string, sellerLegalEntityId: string) =>
    ({
      id,
      title: id,
      saleId: "sale-1",
      sellerLegalEntityId,
      images: ["a.jpg"],
      description: "Oil on canvas",
      artistReviewRequired: false,
      startTime: sale.startTime,
      endTime: sale.endTime,
    }) as Lot;

  it("lists each seller once instead of a line per lot", async () => {
    const saleLots = [lot("l1", "s1"), lot("l2", "s1")];
    const connectRequiredByLotId = { l1: true, l2: true };
    const sellersWithoutPayouts = await nameSellersWithoutPayouts(
      saleLots,
      connectRequiredByLotId,
      async () => "Jane Smith",
    );
    const readiness = buildSaleSetupReadiness({
      saleId: "sale-1",
      sale,
      lots: saleLots,
      connectRequiredByLotId,
      sellersWithoutPayouts,
    });
    const failing = readiness.items.filter((item) => !item.ok).map((item) => item.label);
    expect(failing).toEqual(["Jane Smith has not set up payouts (2 lots)"]);
    expect(readiness.percent).toBeLessThan(100);
  });
});
