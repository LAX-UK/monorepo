import { assembleCoverAnalysis, coverAnalysisHash } from "@auction/domain";
import type {
  CoverAnalysisRecord,
  ICoverAnalysisReader,
  IMediaAssetReader,
  MediaAssetRecord,
} from "@auction/persistence/interfaces";
import type { Sale, SaleCoverSlot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { MediaAssetEnricher } from "../services/media-asset-enricher.js";
import { presentSaleImages, presentSalesWithLotsImages } from "./media-presenters.js";
import { buildSaleCoverSlotAssets, collectCoverSlotKeys } from "./sale-cover-assets.js";

const asset = (key: string, width: number, height: number): MediaAssetRecord => ({
  key,
  width,
  height,
  blurDataURL: `blur:${key}`,
});

function slot(key: string, overrides: Partial<SaleCoverSlot> = {}): SaleCoverSlot {
  const draft = {
    key,
    width: 3200,
    height: 1400,
    focal: { x: 0.7, y: 0.5 },
    zoom: 1,
    alt: "A harbour at dusk",
    ...overrides,
  };
  return { ...draft, analysisHash: coverAnalysisHash("default", draft) };
}

const darkZones = Object.fromEntries(
  ["eyebrow", "title", "sub", "link", "credit"].map((line) => [
    line,
    { brightest: "#303030", darkest: "#101010" },
  ]),
) as never;

const readyAnalysis = assembleCoverAnalysis(
  {
    dominant: [60, 50, 40],
    deepest: [20, 20, 20],
    blurDataURL: "data:image/jpeg;base64,AAAA",
    zones: { desktop: darkZones, wide: darkZones },
  },
  "left",
);

function saleWith(overrides: Partial<Sale>): Sale {
  return {
    id: "sale-1",
    title: "Modern British",
    coverImages: [],
    coverSlots: {},
    ...overrides,
  } as Sale;
}

const resolve = (key: string) => `https://cdn.test/${key}`;

describe("cover slot assets", () => {
  it("presents a stored slot with its address, size, focal point and alt text", () => {
    const stored = slot("uploads/cover.jpg");
    const assets = buildSaleCoverSlotAssets(saleWith({ coverSlots: { default: stored } }), {
      media: (key) => (key === "uploads/cover.jpg" ? asset(key, 3200, 1400) : undefined),
      analysis: () => undefined,
      resolve,
    });
    expect(assets?.default).toMatchObject({
      src: "https://cdn.test/uploads/cover.jpg",
      width: 3200,
      height: 1400,
      focal: { x: 0.7, y: 0.5 },
      alt: "A harbour at dusk",
      side: "left",
      analysisStatus: "pending",
      colours: null,
      scrim: {},
      blurDataURL: "blur:uploads/cover.jpg",
    });
  });

  it("adds colours, the 24px preview and the scrim for each size once analysed", () => {
    const stored = slot("uploads/cover.jpg", { toneOverride: "light" });
    const record: CoverAnalysisRecord = {
      hash: stored.analysisHash,
      status: "ready",
      analysis: readyAnalysis,
    };
    const assets = buildSaleCoverSlotAssets(saleWith({ coverSlots: { default: stored } }), {
      media: () => undefined,
      analysis: (hash) => (hash === stored.analysisHash ? record : undefined),
      resolve,
    });
    const defaultSlot = assets?.default;
    expect(defaultSlot?.analysisStatus).toBe("ready");
    expect(defaultSlot?.blurDataURL).toBe("data:image/jpeg;base64,AAAA");
    expect(defaultSlot?.colours?.dominant).toBe("#3c3228");
    expect(defaultSlot?.scrim.desktop).toMatchObject({ tone: "light" });
    expect(defaultSlot?.scrim.desktop?.strength).toBeGreaterThanOrEqual(0.45);
    expect(defaultSlot?.scrim.wide).toMatchObject({ tone: "light" });
  });

  it("says a failed analysis failed, so the page can use the plate", () => {
    const stored = slot("uploads/cover.jpg");
    const assets = buildSaleCoverSlotAssets(saleWith({ coverSlots: { default: stored } }), {
      media: () => undefined,
      analysis: () => ({ hash: stored.analysisHash, status: "failed", analysis: null }),
      resolve,
    });
    expect(assets?.default).toMatchObject({ analysisStatus: "failed", colours: null, scrim: {} });
  });

  it("measures the wide slot at the wide size only and the phone slot not at all", () => {
    const wide = slot("uploads/wide.jpg");
    const phone = slot("uploads/phone.jpg");
    const record = (s: SaleCoverSlot): CoverAnalysisRecord => ({
      hash: s.analysisHash,
      status: "ready",
      analysis: readyAnalysis,
    });
    const assets = buildSaleCoverSlotAssets(saleWith({ coverSlots: { wide, phone } }), {
      media: () => undefined,
      analysis: (hash) => [wide, phone].map(record).find((r) => r.hash === hash),
      resolve,
    });
    expect(Object.keys(assets?.wide?.scrim ?? {})).toEqual(["wide"]);
    expect(assets?.phone?.scrim).toEqual({});
  });

  it("points a lot detail at the lot photograph and keeps the lot id for the credit link", () => {
    const { key: _upload, ...withoutKey } = slot("ignored");
    const stored: SaleCoverSlot = {
      ...withoutKey,
      fromLot: { lotId: "lot-9", imageKey: "uploads/lot-9.jpg" },
    };
    const assets = buildSaleCoverSlotAssets(saleWith({ coverSlots: { default: stored } }), {
      media: () => undefined,
      analysis: () => undefined,
      resolve,
    });
    expect(assets?.default).toMatchObject({
      src: "https://cdn.test/uploads/lot-9.jpg",
      lotId: "lot-9",
    });
  });

  it("reads the old array by position for slots staff have not set", () => {
    const sale = saleWith({
      title: "Modern British",
      coverImages: ["uploads/a.jpg", "uploads/b.jpg", "uploads/c.jpg"],
    });
    expect(collectCoverSlotKeys(sale)).toEqual(["uploads/a.jpg", "uploads/b.jpg", "uploads/c.jpg"]);
    const assets = buildSaleCoverSlotAssets(sale, {
      media: (key) => asset(key, 2400, 1000),
      analysis: () => undefined,
      resolve,
    });
    expect(assets?.default?.src).toBe("https://cdn.test/uploads/a.jpg");
    expect(assets?.phone?.src).toBe("https://cdn.test/uploads/b.jpg");
    expect(assets?.wide?.src).toBe("https://cdn.test/uploads/c.jpg");
    expect(assets?.default?.alt).toBe("Modern British — auction cover");
    expect(assets?.default?.focal).toEqual({ x: 0.5, y: 0.5 });
  });

  it("leaves out an old-array picture whose size is unknown, and returns nothing without a cover", () => {
    const lookups = { media: () => undefined, analysis: () => undefined, resolve };
    expect(
      buildSaleCoverSlotAssets(saleWith({ coverImages: ["https://seed.example/a.jpg"] }), lookups),
    ).toBeUndefined();
    expect(buildSaleCoverSlotAssets(saleWith({}), lookups)).toBeUndefined();
  });
});

describe("the public sale reads", () => {
  const stored = slot("uploads/cover.jpg");
  const mediaReader: IMediaAssetReader = {
    lookupByKeys: async (keys) =>
      new Map(keys.map((key) => [key, asset(key, 3200, 1400)] as const)),
  };
  const analysisReader: ICoverAnalysisReader = {
    lookupByHashes: async (hashes) =>
      new Map(
        hashes.map((hash) => [hash, { hash, status: "ready", analysis: readyAnalysis }] as const),
      ),
  };
  const enricher = new MediaAssetEnricher(mediaReader, undefined, analysisReader);
  const resolver = {
    resolveManyUnique: async (keys: readonly string[]) =>
      new Map(keys.map((key) => [key, resolve(key)] as const)),
  } as never;

  it("adds coverSlotAssets to one sale", async () => {
    const presented = await presentSaleImages(
      resolver,
      saleWith({ coverSlots: { default: stored } }),
      enricher,
    );
    expect(presented.coverSlotAssets?.default?.src).toBe("https://cdn.test/uploads/cover.jpg");
    expect(presented.coverSlotAssets?.default?.analysisStatus).toBe("ready");
  });

  it("adds them to every sale in a list from one lookup", async () => {
    let analysisLookups = 0;
    const counting: ICoverAnalysisReader = {
      lookupByHashes: async (hashes) => {
        analysisLookups += 1;
        return analysisReader.lookupByHashes(hashes);
      },
    };
    const rows = [
      { sale: saleWith({ id: "a", coverSlots: { default: stored } }), lots: [] },
      { sale: saleWith({ id: "b", coverSlots: { default: slot("uploads/other.jpg") } }), lots: [] },
      { sale: saleWith({ id: "c" }), lots: [] },
    ];
    const presented = await presentSalesWithLotsImages(
      resolver,
      rows,
      new MediaAssetEnricher(mediaReader, undefined, counting),
    );
    expect(presented.map((r) => r.sale.coverSlotAssets?.default?.src)).toEqual([
      "https://cdn.test/uploads/cover.jpg",
      "https://cdn.test/uploads/other.jpg",
      undefined,
    ]);
    expect(analysisLookups).toBe(1);
  });

  it("leaves a sale without covers unchanged", async () => {
    const presented = await presentSaleImages(resolver, saleWith({}), enricher);
    expect(presented.coverSlotAssets).toBeUndefined();
  });
});
