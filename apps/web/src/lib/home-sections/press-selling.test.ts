import { hangSale } from "@/lib/hang/hang-fixtures";
import { buildPress } from "@/lib/home-sections/press";
import { buildSelling } from "@/lib/home-sections/selling";
import type { PressArchiveEntry } from "@auction/types";
import { describe, expect, it } from "vitest";

const entry = (n: number): PressArchiveEntry => ({
  sale: {
    id: `s${n}`,
    title: "Sale",
    status: "ended",
    deliveryMode: "online",
    endTime: null,
    updatedAt: new Date(),
  },
  item: {
    url: `https://news.example/${n}`,
    headline: `Headline ${n}`,
    outletName: "Evening Standard",
    publishedAt: "2026-10-16",
  },
});

describe("buildPress", () => {
  it("labels each item with its outlet and date", () => {
    expect(buildPress([entry(1), entry(2)])?.[0]).toMatchObject({
      href: "https://news.example/1",
      label: "Coverage · Evening Standard · 16 Oct 2026",
      headline: "Headline 1",
    });
  });

  it("shows three at most, and is hidden below two", () => {
    expect(buildPress([entry(1), entry(2), entry(3), entry(4)])).toHaveLength(3);
    expect(buildPress([entry(1)])).toBeNull();
    expect(buildPress([])).toBeNull();
  });
});

describe("buildSelling", () => {
  const now = new Date("2026-11-02T12:00:00.000Z");

  it("names the soonest consignment deadline still ahead", () => {
    const sales = [
      hangSale({ title: "Past", consignmentDeadline: new Date("2026-10-01T12:00:00.000Z") }),
      hangSale({ title: "Later", consignmentDeadline: new Date("2027-02-01T12:00:00.000Z") }),
      hangSale({
        title: "Spring Modern British",
        consignmentDeadline: new Date("2027-01-15T12:00:00.000Z"),
      }),
    ];
    expect(buildSelling({ scheduledSales: sales, imageUrls: [], now }).deadlineNote).toBe(
      "Consignments for Spring Modern British close 15 Jan 2027",
    );
  });

  it("has no note without a deadline, and keeps two pictures at most", () => {
    const selling = buildSelling({
      scheduledSales: [hangSale()],
      imageUrls: ["/a.jpg", null, "/b.jpg", "/c.jpg"],
      now,
    });
    expect(selling.deadlineNote).toBeNull();
    expect(selling.imageUrls).toEqual(["/a.jpg", "/b.jpg"]);
  });
});
