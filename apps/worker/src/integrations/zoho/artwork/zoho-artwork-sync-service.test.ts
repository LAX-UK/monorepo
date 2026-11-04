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
import type { LinkedListingProjector } from "./linked-listing-projector.js";
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
  listings?: LinkedListingProjector,
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
  const service = new ZohoArtworkSyncService({
    mode,
    reader,
    register: registerRepo as never,
    report: report as never,
    watermark: watermark as never,
    ...(listings ? { listings } : {}),
    log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
    now: () => NOW,
  });
  return { service, registerRepo, reader, report, watermark, recorded, watermarks };
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

describe("ZohoArtworkSyncService lax.art listings", () => {
  const entry = {
    id: "id",
    zohoProductId: product(1).id,
    stockCode: "LAX-ORI-PH-GAC-26-0001",
    kind: "original",
    sourceOriginalId: null,
    title: "Old title",
    artist: { zohoArtistId: "5000000000000077001", name: "Aidan Phelan", code: "PH" },
    medium: "Oil on canvas",
    dimensions: "60 x 80 cm",
    year: 2024,
    imageRefs: ["a.jpg"],
    catalogueStatus: "Available",
    offer: { state: "held", ref: null },
    zohoModifiedAt: new Date("2026-09-01T00:00:00.000Z"),
    version: 1,
  } as unknown as ArtworkRegisterEntry;

  it("carries the register's Zoho fields onto the listing after a change", async () => {
    const project = vi.fn(async () => undefined);
    const t = setup("live", [[product(1)]], [entry], { project });
    await t.service.processNotice({ productId: product(1).id, runId: "notice:p1" });
    expect(project).toHaveBeenCalledWith({
      zohoProductId: product(1).id,
      title: "Old title",
      medium: "Oil on canvas",
      dimensions: "60 x 80 cm",
      year: 2024,
      imageRefs: ["a.jpg"],
      artistCode: "PH",
    });
  });

  it("leaves listings alone in a dry run, and for a record it has just created", async () => {
    const project = vi.fn(async () => undefined);
    const dry = setup("dry_run", [[product(1)]], [entry], { project });
    await dry.service.processNotice({ productId: product(1).id, runId: "notice:p2" });
    const created = setup("live", [[product(1)]], [], { project });
    await created.service.processNotice({ productId: product(1).id, runId: "notice:p3" });
    expect(project).not.toHaveBeenCalled();
  });

  it("keeps going when a listing cannot be updated, and says so in the log", async () => {
    const project = vi.fn(async () => {
      throw new Error("listing locked");
    });
    const t = setup("live", [[product(1)]], [entry], { project });
    await t.service.processNotice({ productId: product(1).id, runId: "notice:p4" });
    expect(t.recorded).toHaveLength(1);
  });
});
