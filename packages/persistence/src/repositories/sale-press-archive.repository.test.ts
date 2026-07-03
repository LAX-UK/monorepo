import type { Sale, SalePressRef } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { ISaleRepository } from "../interfaces/sale.repository.js";
import { SalePressArchiveRepository } from "./sale-press-archive.repository.js";

function makeSale(id: string, press: SalePressRef[], endTime: string): Sale {
  return {
    id,
    title: `Sale ${id}`,
    description: null,
    coverImages: [],
    categoryId: null,
    categoryIds: [],
    deliveryMode: "onsite",
    allowOnlineBidsBeforeGoLive: false,
    streamUrl: null,
    locationName: null,
    locationAddress: null,
    locationMapUrl: null,
    locationAddressLine1: null,
    locationAddressLine2: null,
    locationCity: null,
    locationCounty: null,
    locationPostcode: null,
    locationCountry: null,
    status: "ended",
    startTime: new Date("2026-01-01"),
    endTime: new Date(endTime),
    previewStartTime: null,
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: null,
    terms: null,
    createdBy: "admin",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date(endTime),
    pressCoverage: press,
  } as Sale;
}

describe("SalePressArchiveRepository", () => {
  it("paginates through all ended sales and returns availableYears from full archive", async () => {
    const allSales = [
      ...Array.from({ length: 200 }, (_, i) =>
        makeSale(
          `old-${i}`,
          i === 0
            ? [
                {
                  url: "https://x.com/a",
                  headline: "Old",
                  outletName: "O",
                  publishedAt: "2020-01-01",
                },
              ]
            : [],
          "2020-06-01T12:00:00.000Z",
        ),
      ),
      makeSale(
        "new-1",
        [{ url: "https://x.com/b", headline: "New", outletName: "O", publishedAt: "2026-06-02" }],
        "2026-06-01T18:00:00.000Z",
      ),
    ];
    const saleRepo: ISaleRepository = {
      list: vi.fn(async ({ offset, limit }) => allSales.slice(offset, offset + limit)),
    } as unknown as ISaleRepository;

    const repo = new SalePressArchiveRepository(saleRepo);
    const page = await repo.listCoveragePage({
      statuses: ["ended"],
      limit: 10,
      offset: 0,
    });

    expect(page.total).toBe(2);
    expect(page.archiveTotal).toBe(2);
    expect(page.outletCount).toBe(1);
    expect(page.data[0]?.item.headline).toBe("New");
    expect(page.availableYears).toEqual([2026, 2020]);
    expect(saleRepo.list).toHaveBeenCalledTimes(2);
  });

  it("filters by year and q in a single pass", async () => {
    const saleRepo: ISaleRepository = {
      list: vi.fn(async () => [
        makeSale(
          "s1",
          [
            {
              url: "https://x.com/a",
              headline: "Evening record",
              outletName: "BBC",
              publishedAt: "2026-01-01",
            },
            {
              url: "https://x.com/b",
              headline: "Morning sale",
              outletName: "Times",
              publishedAt: "2025-12-01",
            },
          ],
          "2026-06-01T18:00:00.000Z",
        ),
      ]),
    } as unknown as ISaleRepository;

    const repo = new SalePressArchiveRepository(saleRepo);
    const page = await repo.listCoveragePage({
      statuses: ["ended"],
      limit: 10,
      offset: 0,
      year: 2026,
      q: "evening",
    });

    expect(page.total).toBe(1);
    expect(page.data[0]?.item.headline).toBe("Evening record");
    expect(page.availableYears).toEqual([2026, 2025]);
  });

  it("filters by mention type", async () => {
    const saleRepo: ISaleRepository = {
      list: vi.fn(async () => [
        makeSale(
          "s1",
          [
            {
              url: "https://x.com/a",
              headline: "Feature story",
              outletName: "BBC",
              publishedAt: "2026-01-01",
              mentionType: "feature",
            },
            {
              url: "https://x.com/b",
              headline: "Interview piece",
              outletName: "Times",
              publishedAt: "2026-01-02",
              mentionType: "interview",
            },
          ],
          "2026-06-01T18:00:00.000Z",
        ),
      ]),
    } as unknown as ISaleRepository;

    const repo = new SalePressArchiveRepository(saleRepo);
    const page = await repo.listCoveragePage({
      statuses: ["ended"],
      limit: 10,
      offset: 0,
      mentionType: "interview",
    });

    expect(page.total).toBe(1);
    expect(page.data[0]?.item.mentionType).toBe("interview");
    expect(page.archiveTotal).toBe(2);
    expect(page.outletCount).toBe(2);
  });
});
