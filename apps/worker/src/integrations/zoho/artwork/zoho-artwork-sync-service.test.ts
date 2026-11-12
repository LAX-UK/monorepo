import type {
  ArtworkRegisterEntry,
  NewArtworkRegisterEntry,
} from "@auction/artwork-register-contracts";
import type {
  ZohoArtworkSyncMode,
  ZohoArtworkSyncOutcomeInput,
  ZohoArtworkSyncSummary,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { CatalogueProduct } from "./catalogue-product.js";
import { product } from "./fixtures/load-fixtures.js";
import {
  type ZohoArtworkSyncModeSetting,
  ZohoArtworkSyncService,
} from "./zoho-artwork-sync-service.js";
import type { ZohoCatalogueReader } from "./zoho-catalogue-reader.js";

const NOW = new Date("2026-11-03T02:30:00.000Z");

function summarise(rows: ZohoArtworkSyncOutcomeInput[]): ZohoArtworkSyncSummary {
  const summary: ZohoArtworkSyncSummary = {
    create: 0,
    update: 0,
    conflict: 0,
    unchanged: 0,
    stale: 0,
    skipped: 0,
  };
  for (const row of rows) summary[row.outcome] += 1;
  return summary;
}

function setup(
  mode: ZohoArtworkSyncModeSetting,
  pages: CatalogueProduct[][] = [],
  existing: ArtworkRegisterEntry[] = [],
) {
  const register = new Map(existing.map((e) => [e.zohoProductId, e]));
  const recorded: ZohoArtworkSyncOutcomeInput[] = [];
  const watermarks = new Map<ZohoArtworkSyncMode, Date>();

  const registerRepo = {
    findByZohoProductId: vi.fn(async (id: string) => register.get(id) ?? null),
    findByStockCode: vi.fn(
      async (code: string) => [...register.values()].find((e) => e.stockCode === code) ?? null,
    ),
    create: vi.fn(async (entry: NewArtworkRegisterEntry) => {
      const created = {
        ...entry,
        id: "id",
        offer: { state: "held", ref: null },
        version: 1,
      } as never;
      register.set(entry.zohoProductId, created);
      return { ok: true as const, entry: created };
    }),
    applyZohoChange: vi.fn(async () => ({ status: "applied" })),
  };
  const reader: ZohoCatalogueReader = {
    fetchProduct: vi.fn(async (id: string) => pages.flat().find((p) => p.id === id) ?? null),
    fetchModifiedSince: vi.fn(async function* () {
      for (const page of pages) yield page;
    }),
  };
  const report = {
    record: vi.fn(
      async (
        _run: string,
        _mode: ZohoArtworkSyncMode,
        rows: readonly ZohoArtworkSyncOutcomeInput[],
      ) => {
        recorded.push(...rows);
      },
    ),
    summarise: vi.fn(async () => summarise(recorded)),
  };
  const watermark = {
    get: vi.fn(async (m: ZohoArtworkSyncMode) => watermarks.get(m) ?? null),
    advance: vi.fn(async (m: ZohoArtworkSyncMode, to: Date) => {
      watermarks.set(m, to);
    }),
  };
  const images = {
    syncProduct: vi.fn(async () => ({
      status: "checked" as const,
      remote: 2,
      reused: 1,
      downloaded: 1,
      rejected: 0,
      failed: 0,
      removed: 0,
      ignored: 0,
      changed: mode === "live",
    })),
  };
  const imageCheck = { listImageCheckCandidates: vi.fn(async () => []) };
  const service = new ZohoArtworkSyncService({
    mode,
    reader,
    images,
    imageCheck: imageCheck as never,
    register: registerRepo as never,
    report: report as never,
    watermark: watermark as never,
    log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn() } as never,
    now: () => NOW,
  });
  return {
    service,
    registerRepo,
    reader,
    report,
    watermark,
    recorded,
    watermarks,
    images,
    imageCheck,
  };
}

const everyProduct = () => [1, 2, 3, 4, 5, 6, 7].map(product);

describe("ZohoArtworkSyncService mode handling", () => {
  it("does nothing when the mode is off", async () => {
    const t = setup("off", [everyProduct()]);
    expect(
      await t.service.processNotice({ productId: "5000000000001000001", runId: "notice:a" }),
    ).toEqual({
      ran: false,
      reason: "mode_off",
    });
    expect(await t.service.runNightly()).toEqual({ ran: false, reason: "mode_off" });
    expect(t.reader.fetchProduct).not.toHaveBeenCalled();
    expect(t.reader.fetchModifiedSince).not.toHaveBeenCalled();
    expect(t.report.record).not.toHaveBeenCalled();
    expect(t.registerRepo.create).not.toHaveBeenCalled();
  });

  it("in dry run reports what would be created and changes nothing in the register", async () => {
    const t = setup("dry_run", [everyProduct()]);
    const result = await t.service.runNightly();
    expect(result).toMatchObject({ ran: true, runId: "nightly:dry_run:2026-11-03" });
    expect(t.registerRepo.create).not.toHaveBeenCalled();
    expect(t.registerRepo.applyZohoChange).not.toHaveBeenCalled();

    const byId = new Map(t.recorded.map((r) => [r.zohoProductId.slice(-1), r]));
    expect(byId.get("1")).toMatchObject({ outcome: "create", reason: null });
    expect(byId.get("2")).toMatchObject({ outcome: "create" });
    expect(byId.get("3")).toMatchObject({ outcome: "skipped", reason: "demo_artist" });
    expect(byId.get("4")).toMatchObject({ outcome: "skipped", reason: "missing_stock_code" });
    expect(byId.get("5")).toMatchObject({ outcome: "skipped", reason: "invalid_stock_code" });
    expect(byId.get("6")).toMatchObject({ outcome: "skipped", reason: "missing_artist" });
    expect(byId.get("7")).toMatchObject({ outcome: "create" });
    expect(byId.get("2")?.detail).toMatchObject({
      gaps: ["missing_medium", "missing_dimensions", "missing_price"],
    });
  });

  it("in live mode creates entries through the register as the Zoho actor", async () => {
    const t = setup("live", [everyProduct()]);
    await t.service.runNightly();
    expect(t.registerRepo.create).toHaveBeenCalledTimes(3);
    expect(t.registerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ stockCode: "LAX-ORI-PH-GAC-26-0001" }),
      "zoho",
      NOW,
    );
  });

  it("in live mode records a refused create as a skip, not an error", async () => {
    const t = setup("live", [[product(1)]]);
    t.registerRepo.create.mockResolvedValueOnce({
      ok: false,
      reason: "duplicate_stock_code",
    } as never);
    await t.service.runNightly();
    expect(t.recorded[0]).toMatchObject({
      outcome: "skipped",
      reason: "register_refused_duplicate_stock_code",
    });
  });
});

describe("ZohoArtworkSyncService nightly check", () => {
  it("reads everything on the first run and moves the watermark to the newest change", async () => {
    const t = setup("dry_run", [[product(1), product(2)], [product(7)]]);
    await t.service.runNightly();
    expect(t.reader.fetchModifiedSince).toHaveBeenCalledWith(null);
    expect(t.watermark.advance).toHaveBeenCalledWith("dry_run", product(7).modifiedAt, NOW);
    expect(t.report.record).toHaveBeenCalledTimes(2);
  });

  it("reads only after the watermark next time, and leaves it alone when nothing changed", async () => {
    const t = setup("dry_run", []);
    const since = new Date("2026-11-02T02:30:00.000Z");
    t.watermarks.set("dry_run", since);
    await t.service.runNightly();
    expect(t.reader.fetchModifiedSince).toHaveBeenCalledWith(since);
    expect(t.watermark.advance).not.toHaveBeenCalled();
  });

  it("keeps a separate watermark for each mode, so live starts with its own full pass", async () => {
    const t = setup("live", [[product(1)]]);
    t.watermarks.set("dry_run", new Date("2026-11-02T00:00:00.000Z"));
    await t.service.runNightly();
    expect(t.reader.fetchModifiedSince).toHaveBeenCalledWith(null);
  });

  it("does not move the watermark when a page fails, so the next run reads again", async () => {
    const t = setup("dry_run", [[product(1)], [product(7)]]);
    t.registerRepo.findByZohoProductId
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("database unavailable"));
    await expect(t.service.runNightly()).rejects.toThrow("database unavailable");
    expect(t.watermark.advance).not.toHaveBeenCalled();
  });
});

describe("ZohoArtworkSyncService notices", () => {
  it("reads the named Product and records its outcome under the notice's run", async () => {
    const t = setup("dry_run", [[product(1)]]);
    const result = await t.service.processNotice({ productId: product(1).id, runId: "notice:k1" });
    expect(result).toMatchObject({ ran: true, runId: "notice:k1" });
    expect(t.report.record).toHaveBeenCalledWith("notice:k1", "dry_run", expect.any(Array), NOW);
    expect(t.recorded[0]).toMatchObject({ outcome: "create" });
    expect(t.watermark.advance).not.toHaveBeenCalled();
  });

  it("records a Product Zoho no longer has", async () => {
    const t = setup("dry_run", []);
    await t.service.processNotice({ productId: "5000000000009999999", runId: "notice:k2" });
    expect(t.recorded[0]).toMatchObject({ outcome: "skipped", reason: "not_found_in_zoho" });
  });

  it("names the LAX record of a deleted Product and changes nothing in the register", async () => {
    const t = setup("live", [], []);
    t.registerRepo.findByZohoProductId.mockResolvedValueOnce({
      stockCode: "LAX-ORI-PH-GAC-26-0001",
      title: "Harbour at Dusk",
    } as never);
    await t.service.processNotice({ productId: "5000000000009999999", runId: "notice:k3" });
    expect(t.recorded[0]).toMatchObject({
      outcome: "skipped",
      reason: "not_found_in_zoho",
      stockCode: "LAX-ORI-PH-GAC-26-0001",
      title: "Harbour at Dusk",
    });
    expect(t.registerRepo.applyZohoChange).not.toHaveBeenCalled();
  });

  it("is idempotent in live mode: the same Product twice creates once, then finds it unchanged", async () => {
    const t = setup("live", [[product(1)]]);
    await t.service.processNotice({ productId: product(1).id, runId: "notice:a" });
    await t.service.processNotice({ productId: product(1).id, runId: "notice:b" });
    expect(t.registerRepo.create).toHaveBeenCalledTimes(1);
    expect(t.recorded.map((r) => r.outcome)).toEqual(["create", "stale"]);
  });

  it("applies updates and conflicts through the register in live mode", async () => {
    const existing = {
      id: "id",
      zohoProductId: product(1).id,
      stockCode: "LAX-ORI-PH-GAC-26-0099",
      kind: "original",
      sourceOriginalId: null,
      title: "Old title",
      artist: { zohoArtistId: "5000000000000077001", name: "Aidan Phelan", code: "PH" },
      medium: "Oil on canvas",
      dimensions: "60 x 80 cm",
      year: 2024,
      imageRefs: [],
      catalogueStatus: "Available",
      offer: { state: "held", ref: null },
      zohoModifiedAt: new Date("2026-09-01T00:00:00.000Z"),
      version: 1,
    } as unknown as ArtworkRegisterEntry;
    const t = setup("live", [[product(1)]], [existing]);
    await t.service.processNotice({ productId: product(1).id, runId: "notice:c" });
    expect(t.registerRepo.applyZohoChange).toHaveBeenCalledTimes(1);
    expect(t.recorded[0]).toMatchObject({ outcome: "conflict" });
    expect(t.recorded[0]?.detail).toMatchObject({
      changes: { title: { from: "Old title", to: "Harbour at dusk" } },
      conflicts: [{ field: "stockCode" }],
    });
  });
});

describe("ZohoArtworkSyncService pictures", () => {
  it("checks the pictures of each original it creates, and reports the counts with the outcome", async () => {
    const t = setup("live", [everyProduct()]);
    await t.service.runNightly();
    // Prints draw no offer on lax.art, so only the originals among the three are checked.
    const created = t.recorded.filter((r) => r.outcome === "create");
    const withPictures = created.filter((r) => "images" in r.detail);
    expect(created).toHaveLength(3);
    expect(withPictures).toHaveLength(2);
    expect(t.images.syncProduct).toHaveBeenCalledTimes(2);
    expect(t.images.syncProduct).toHaveBeenCalledWith(expect.any(String), "live");
    for (const row of withPictures) {
      expect(row.stockCode).toContain("-ORI-");
      expect(row.detail).toMatchObject({ images: { remote: 2, downloaded: 1, changed: true } });
    }
  });

  it("does not look at pictures for a Product that was skipped", async () => {
    const t = setup("live", [[product(3), product(4)]]);
    await t.service.runNightly();
    expect(t.images.syncProduct).not.toHaveBeenCalled();
  });

  it("in dry run asks for the counts only and the register stays untouched", async () => {
    const t = setup("dry_run", [everyProduct()]);
    await t.service.runNightly();
    expect(t.images.syncProduct).toHaveBeenCalledWith(expect.any(String), "dry_run");
    expect(t.registerRepo.create).not.toHaveBeenCalled();
  });

  it("keeps the Product's outcome when the picture check fails", async () => {
    const t = setup("live", [[product(1)]]);
    t.images.syncProduct.mockRejectedValueOnce(new Error("zoho down"));
    await t.service.runNightly();
    expect(t.recorded[0]).toMatchObject({ outcome: "create" });
    expect(t.recorded[0]?.detail).not.toHaveProperty("images");
  });

  it("re-checks records whose pictures were not compared recently, one failure not stopping the rest", async () => {
    const t = setup("live", []);
    t.imageCheck.listImageCheckCandidates.mockResolvedValueOnce([
      { zohoProductId: "a", sources: [] },
      { zohoProductId: "b", sources: [] },
    ] as never);
    t.images.syncProduct.mockRejectedValueOnce(new Error("boom"));
    await t.service.runNightly();
    expect(t.imageCheck.listImageCheckCandidates).toHaveBeenCalledWith(
      new Date(NOW.getTime() - 20 * 60 * 60 * 1000),
      300,
    );
    expect(t.images.syncProduct).toHaveBeenCalledTimes(2);
  });
});
