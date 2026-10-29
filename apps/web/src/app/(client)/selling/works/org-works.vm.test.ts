import type { EntityWonLot } from "@/lib/data/http/payments.server";
import { describe, expect, it } from "vitest";
import { toOrgWorkRows } from "./org-works.vm";

const win: EntityWonLot = {
  lotId: "lot-1",
  lotNumber: 12,
  title: "Harbour at dusk",
  imageUrl: "https://media.example/harbour.jpg",
  endedAt: "2026-09-14T16:30:00.000Z",
  hammerPrice: "4200.00",
};

describe("toOrgWorkRows", () => {
  it("formats the lot number, date and hammer price for display", () => {
    const [row] = toOrgWorkRows([win]);
    expect(row).toMatchObject({
      lotId: "lot-1",
      title: "Harbour at dusk",
      lotNumberLabel: "Lot 12",
      endedAtLabel: "14 Sept 2026",
      endedAtIso: "2026-09-14T16:30:00.000Z",
      hammerPriceLabel: "£4,200.00",
    });
    expect(row?.href).toContain("lot-1");
  });

  it("leaves the price out for members whose role has no money", () => {
    const [row] = toOrgWorkRows([{ ...win, hammerPrice: null }]);
    expect(row?.hammerPriceLabel).toBeNull();
  });

  it("copes with a missing lot number and an unreadable date", () => {
    const [row] = toOrgWorkRows([{ ...win, lotNumber: null, endedAt: "soon" }]);
    // No placeholder dash: the row simply leaves the fact out.
    expect(row?.lotNumberLabel).toBeNull();
    expect(row?.endedAtLabel).toBe("soon");
  });
});
