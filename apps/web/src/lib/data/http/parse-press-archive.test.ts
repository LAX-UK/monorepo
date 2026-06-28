import { parsePressArchiveListResponse } from "@/lib/data/http/parse-press-archive";
import { describe, expect, it } from "vitest";

describe("parsePressArchiveListResponse", () => {
  it("skips rows with invalid sale.updatedAt", () => {
    const result = parsePressArchiveListResponse({
      data: [
        {
          sale: {
            id: "bad",
            title: "Bad",
            status: "ended",
            deliveryMode: "onsite",
            endTime: null,
            updatedAt: "not-a-date",
          },
          item: { url: "https://x.com", headline: "H", outletName: "O" },
        },
        {
          sale: {
            id: "good",
            title: "Good",
            status: "ended",
            deliveryMode: "onsite",
            endTime: null,
            updatedAt: "2026-06-02T10:00:00.000Z",
          },
          item: { url: "https://y.com", headline: "OK", outletName: "O" },
        },
      ],
      meta: { total: 2, lastUpdated: "2026-06-03T12:00:00.000Z", availableYears: [2026] },
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.sale.id).toBe("good");
    expect(result.meta.availableYears).toEqual([2026]);
  });

  it("parses archiveTotal and outletCount from meta", () => {
    const result = parsePressArchiveListResponse({
      data: [],
      meta: {
        total: 0,
        archiveTotal: 42,
        outletCount: 9,
        lastUpdated: null,
        availableYears: [2026, 2020],
      },
    });

    expect(result.meta).toMatchObject({
      total: 0,
      archiveTotal: 42,
      outletCount: 9,
      availableYears: [2026, 2020],
    });
  });
});
