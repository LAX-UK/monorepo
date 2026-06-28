import { describe, expect, it, vi } from "vitest";
import type { IPressArchiveRepository } from "./interfaces/press-archive.repository.js";
import { PressArchiveReadService } from "./press-archive-read.service.js";

describe("PressArchiveReadService", () => {
  const repo: IPressArchiveRepository = {
    listCoveragePage: vi.fn(),
    listDayMediaSales: vi.fn(),
    listSitemapFreshness: vi.fn(),
  };

  it("defaults to ended sales for anonymous viewers", async () => {
    vi.mocked(repo.listCoveragePage).mockResolvedValue({
      data: [],
      total: 0,
      lastUpdated: null,
      availableYears: [],
    });
    const svc = new PressArchiveReadService(repo);
    await svc.listCoverage({ limit: 10, offset: 0 });
    expect(repo.listCoveragePage).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: ["ended"], limit: 10, offset: 0 }),
    );
  });

  it("returns meta total, lastUpdated, and availableYears", async () => {
    vi.mocked(repo.listCoveragePage).mockResolvedValue({
      data: [
        {
          sale: {
            id: "s1",
            title: "Sale",
            status: "ended",
            deliveryMode: "onsite",
            endTime: new Date("2026-06-01"),
            updatedAt: new Date("2026-06-01"),
          },
          item: { url: "https://x.com", headline: "H", outletName: "O", publishedAt: "2026-06-02" },
        },
      ],
      total: 1,
      lastUpdated: new Date("2026-06-02"),
      availableYears: [2026],
    });
    const svc = new PressArchiveReadService(repo);
    const result = await svc.listCoverage({ limit: 10, offset: 0 });
    expect(result.meta).toEqual({
      total: 1,
      lastUpdated: new Date("2026-06-02"),
      availableYears: [2026],
    });
  });
});
