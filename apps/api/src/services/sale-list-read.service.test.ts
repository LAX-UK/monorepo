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

  function atgListService(distribution: "public_marketplace" | "private_test") {
    const atgDraft = { ...sale("s-atg"), status: "draft" } as Sale;
    const plainDraft = { ...sale("s-draft"), status: "draft" } as Sale;
    const saleRepo = { list: vi.fn(async () => [sale("s1"), atgDraft, plainDraft]) };
    const lotRepo = {
      countLotsBySaleIds: vi.fn(async () => new Map<string, number>()),
      findPreviewLotsBySaleIds: vi.fn(async () => [
        { ...lotRow("l-atg", "s-atg"), status: "draft" } as Lot,
      ]),
    };
    const getSaleOwnerships = vi.fn(
      async () =>
        new Map([
          [
            "s-atg",
            {
              saleStatus: "draft" as const,
              atgRemoteStatus: "published" as const,
              atgLinked: true,
              atgSoldLotCount: 0,
              sellingPlatform: "atg" as const,
              atgDistribution: distribution,
            },
          ],
        ]),
    );
    const svc = new SaleListReadService(
      saleRepo as never,
      lotRepo as never,
      { resolveManyUnique: vi.fn(async () => new Map()) } as never,
      {
        lookupByKeys: vi.fn(async () => new Map()),
        buildGalleryImages: vi.fn(async () => []),
        buildGalleryImagesWithLookup: vi.fn(async () => []),
      } as never,
      { getSaleOwnerships },
    );
    return { svc, saleRepo, getSaleOwnerships };
  }

  it("includes publicly listed ATG-owned drafts with one batched ownership lookup", async () => {
    const { svc, saleRepo, getSaleOwnerships } = atgListService("public_marketplace");

    const { data } = await svc.listForPublicApi({
      limit: 20,
      offset: 0,
      statuses: ["scheduled", "active"],
    });

    expect(saleRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: ["scheduled", "active"], includeAtgOwnedDrafts: true }),
    );
    expect(getSaleOwnerships).toHaveBeenCalledTimes(1);
    expect(getSaleOwnerships).toHaveBeenCalledWith(["s-atg", "s-draft"]);
    expect(data.map((row) => row.sale.id)).toEqual(["s1", "s-atg"]);
    expect(data[1]?.sale.sellingPlatform).toBe("atg");
    expect(data[1]?.previewLots.map((l) => l.id)).toEqual(["l-atg"]);
  });

  it("excludes draft sales, including private-test ATG drafts, from the public list", async () => {
    const { svc } = atgListService("private_test");

    const { data } = await svc.listForPublicApi({ limit: 20, offset: 0 });

    expect(data.map((row) => row.sale.id)).toEqual(["s1"]);
  });

  it("returns published and active sales", async () => {
    const saleRepo = { list: vi.fn(async () => [sale("s1")]) };
    const lotRepo = {
      countLotsBySaleIds: vi.fn(async () => new Map<string, number>()),
      findPreviewLotsBySaleIds: vi.fn(async () => []),
    };
    const svc = new SaleListReadService(
      saleRepo as never,
      lotRepo as never,
      { resolveManyUnique: vi.fn(async () => new Map()) } as never,
      {
        lookupByKeys: vi.fn(async () => new Map()),
        buildGalleryImages: vi.fn(async () => []),
        buildGalleryImagesWithLookup: vi.fn(async () => []),
      } as never,
    );

    const { data } = await svc.listForPublicApi({ limit: 20, offset: 0 });

    expect(data.map((row) => row.sale.id)).toEqual(["s1"]);
  });
});
