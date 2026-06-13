import type { Lot, Sale } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { SaleListReadService } from "./sale-list-read.service.js";

const sale = (id: string): Sale =>
  ({
    id,
    title: `Sale ${id}`,
    status: "active",
    coverImages: ["cover-1"],
  }) as Sale;

const lotRow = (id: string, saleId: string): Lot =>
  ({
    id,
    saleId,
    title: `Lot ${id}`,
    status: "active",
    images: [`img-${id}`],
  }) as Lot;

describe("SaleListReadService", () => {
  it("returns preview lots and counts without loading all lots per sale", async () => {
    const saleRepo = {
      list: vi.fn(async () => [sale("s1"), sale("s2")]),
    };
    const lotRepo = {
      countLotsBySaleIds: vi.fn(async (ids: string[]) => {
        const map = new Map<string, number>();
        for (const id of ids) map.set(id, id === "s1" ? 12 : 3);
        return map;
      }),
      findPreviewLotsBySaleIds: vi.fn(async (ids: string[], limit: number) => {
        return ids.flatMap((saleId) =>
          Array.from({ length: limit }, (_, i) => lotRow(`${saleId}-lot-${i + 1}`, saleId)),
        );
      }),
    };
    const resolveManyUnique = vi.fn(async (keys: string[]) => {
      const map = new Map<string, string>();
      for (const key of keys) map.set(key, key);
      return map;
    });
    const lookupByKeys = vi.fn(async () => new Map());
    const enricher = {
      lookupByKeys,
      buildGalleryImages: vi.fn(async () => []),
      buildGalleryImagesWithLookup: vi.fn(async () => []),
    };

    const svc = new SaleListReadService(
      saleRepo as never,
      lotRepo as never,
      { resolveManyUnique } as never,
      enricher as never,
    );

    const { data } = await svc.listForPublicApi({ limit: 20, offset: 0 });

    expect(lotRepo.countLotsBySaleIds).toHaveBeenCalledWith(["s1", "s2"], { publicOnly: true });
    expect(lotRepo.findPreviewLotsBySaleIds).toHaveBeenCalledWith(["s1", "s2"], 4, {
      publicOnly: true,
    });
    expect(data[0]?.lotCount).toBe(12);
    expect(data[0]?.previewLots).toHaveLength(4);
    expect(resolveManyUnique).toHaveBeenCalledTimes(1);
  });
});
