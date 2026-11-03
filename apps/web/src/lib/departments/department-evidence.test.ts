import type { SaleListRow } from "@/lib/sale-list-row";
import type { Category, Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  findDepartmentCategory,
  hasDepartmentEvidence,
  nextConsignmentDeadline,
  onSaleWorks,
  soldWorks,
} from "./department-evidence";

const NOW = new Date("2026-11-02T10:00:00.000Z");

function lot(over: Partial<Lot> = {}): Lot {
  return {
    id: "l1",
    title: "Lot",
    status: "ended",
    currentPrice: "1000.00",
    winnerId: null,
    hasWinner: true,
    ...over,
  } as Lot;
}

function sale(over: Partial<Sale> = {}): SaleListRow {
  return {
    sale: { id: "s1", title: "Winter sale", categoryIds: [], ...over } as Sale,
    lots: [],
    lotCount: 0,
  };
}

describe("findDepartmentCategory", () => {
  const categories = [
    { id: "c1", slug: "watches-clocks", archived: false },
    { id: "c2", slug: "old", archived: true },
  ] as Category[];

  it("finds a live category by slug", () => {
    expect(findDepartmentCategory(categories, "watches-clocks")?.id).toBe("c1");
  });
  it("ignores archived and unknown categories", () => {
    expect(findDepartmentCategory(categories, "old")).toBeNull();
    expect(findDepartmentCategory(categories, "nope")).toBeNull();
  });
});

describe("soldWorks", () => {
  it("keeps sold lots only", () => {
    const sold = lot({
      id: "a",
      checkoutPricing: {
        hammerMajor: "1000.00",
        premiumMajor: "250.00",
        totalMajor: "1250.00",
        policyId: "flat:0.25",
        kind: "flat",
      },
    });
    const unsold = lot({ id: "b", hasWinner: false });
    const result = soldWorks([unsold, sold]);
    expect(result.map((w) => w.lot.id)).toEqual(["a"]);
  });

  it("stops at the limit", () => {
    const many = Array.from({ length: 9 }, (_, i) => lot({ id: `l${i}` }));
    expect(soldWorks(many, 4)).toHaveLength(4);
  });
});

describe("onSaleWorks", () => {
  it("keeps live and coming-up lots", () => {
    const rows = [
      lot({ id: "a", status: "active" }),
      lot({ id: "b", status: "ended" }),
      lot({ id: "c", status: "scheduled" }),
    ];
    expect(onSaleWorks(rows).map((l) => l.id)).toEqual(["a", "c"]);
  });
});

describe("nextConsignmentDeadline", () => {
  it("takes the soonest future deadline on a sale that takes the department", () => {
    const rows = [
      sale({ id: "far", title: "Spring", consignmentDeadline: "2027-01-15T12:00:00.000Z" }),
      sale({ id: "near", title: "Winter", consignmentDeadline: "2026-12-01T12:00:00.000Z" }),
    ];
    expect(nextConsignmentDeadline(rows, "c1", NOW)).toEqual({
      date: "1 Dec 2026",
      saleTitle: "Winter",
      saleId: "near",
    });
  });

  it("skips past deadlines and sales for other departments", () => {
    const rows = [
      sale({ id: "past", consignmentDeadline: "2026-10-01T12:00:00.000Z" }),
      sale({ id: "other", categoryIds: ["c9"], consignmentDeadline: "2026-12-01T12:00:00.000Z" }),
      sale({ id: "none" }),
    ];
    expect(nextConsignmentDeadline(rows, "c1", NOW)).toBeNull();
  });

  it("accepts a sale that lists the department", () => {
    const rows = [
      sale({ id: "mine", categoryIds: ["c1"], consignmentDeadline: "2026-12-01T12:00:00.000Z" }),
    ];
    expect(nextConsignmentDeadline(rows, "c1", NOW)?.saleId).toBe("mine");
  });
});

describe("hasDepartmentEvidence", () => {
  it("is false when every part is empty", () => {
    expect(hasDepartmentEvidence({ sold: [], onSale: [], deadline: null })).toBe(false);
  });
  it("is true with a deadline alone", () => {
    expect(
      hasDepartmentEvidence({
        sold: [],
        onSale: [],
        deadline: { date: "x", saleTitle: "y", saleId: "z" },
      }),
    ).toBe(true);
  });
});
