import type { NewArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { DrizzleArtworkRegisterRepository } from "./index.js";

const url = process.env.DATABASE_URL;
const db = url ? createDb(url) : (null as never);

const T0 = new Date("2026-11-03T09:00:00.000Z");
const T1 = new Date("2026-11-03T10:00:00.000Z");
const T2 = new Date("2026-11-03T11:00:00.000Z");
const staff = "staff:u1";

function newEntry(overrides: Partial<NewArtworkRegisterEntry> = {}): NewArtworkRegisterEntry {
  return {
    zohoProductId: "5001",
    stockCode: "LAX-ORI-PH-GAC-26-0001",
    kind: "original",
    sourceOriginalId: null,
    title: "Harbour at dusk",
    artist: { zohoArtistId: "77", name: "Aidan Phelan", code: "PH" },
    medium: "Oil on canvas",
    dimensions: "60 x 80 cm",
    year: 2024,
    imageRefs: ["img-1"],
    catalogueStatus: "Available",
    ...overrides,
  };
}

describe.skipIf(!url)("artwork register repository (Postgres)", { timeout: 30_000 }, () => {
  const repo = new DrizzleArtworkRegisterRepository(db);

  beforeEach(async () => {
    // Not TRUNCATE ... CASCADE: Bid lots reference the register, and a cascade would wipe them too.
    await db.execute(
      sql`UPDATE lot SET artwork_register_id = NULL WHERE artwork_register_id IS NOT NULL`,
    );
    await db.execute(sql`TRUNCATE artwork_register_conflict, artwork_register_event`);
    await db.execute(sql`UPDATE artwork_register SET source_original_id = NULL`);
    await db.execute(sql`DELETE FROM artwork_register`);
  });

  async function created() {
    const result = await repo.create(newEntry(), "system", T0);
    if (!result.ok) throw new Error(result.reason);
    return result.entry;
  }

  it("creates a held entry and finds it by id, Zoho product and stock code", async () => {
    const entry = await created();
    expect(entry.offer).toEqual({ state: "held", ref: null });
    expect(entry.version).toBe(1);
    expect(await repo.findById(entry.id)).toEqual(entry);
    expect(await repo.findByZohoProductId("5001")).toEqual(entry);
    expect(await repo.findByStockCode("LAX-ORI-PH-GAC-26-0001")).toEqual(entry);
    expect(await repo.findByStockCode("LAX-ORI-PH-GAC-26-0009")).toBeNull();
    expect((await repo.listEvents(entry.id, 10)).map((e) => e.type)).toEqual(["created"]);
  });

  it("refuses a second record for the same Zoho product or stock code", async () => {
    await created();
    expect(
      await repo.create(newEntry({ stockCode: "LAX-ORI-PH-GAC-26-0002" }), "system", T0),
    ).toEqual({
      ok: false,
      reason: "duplicate_zoho_product",
    });
    expect(await repo.create(newEntry({ zohoProductId: "5002" }), "system", T0)).toEqual({
      ok: false,
      reason: "duplicate_stock_code",
    });
  });

  it("links a print to its original, and only to an original", async () => {
    const original = await created();
    const print = await repo.create(
      newEntry({
        zohoProductId: "5002",
        stockCode: "LAX-PRI-PH-GAC-26-0001",
        kind: "print",
        sourceOriginalId: original.id,
      }),
      "system",
      T0,
    );
    expect(print.ok && print.entry.sourceOriginalId).toBe(original.id);

    const printId = print.ok ? print.entry.id : "";
    for (const bad of [
      newEntry({
        zohoProductId: "5003",
        stockCode: "LAX-PRI-PH-GAC-26-0002",
        kind: "print",
        sourceOriginalId: printId,
      }),
      newEntry({
        zohoProductId: "5004",
        stockCode: "LAX-ORI-PH-GAC-26-0004",
        sourceOriginalId: original.id,
      }),
      newEntry({
        zohoProductId: "5005",
        stockCode: "LAX-PRI-PH-GAC-26-0005",
        kind: "print",
        sourceOriginalId: "00000000-0000-4000-8000-000000000000",
      }),
    ]) {
      expect(await repo.create(bad, "system", T0)).toEqual({
        ok: false,
        reason: "source_original_invalid",
      });
    }
  });

  it("reports the highest number for a kind, artist and collection across years", async () => {
    const series = { kind: "original", artist: "PH", second: "GAC" } as const;
    expect(await repo.highestStockNumber(series)).toBeNull();
    await created();
    await repo.create(
      newEntry({ zohoProductId: "5002", stockCode: "LAX-ORI-PH-GAC-26-0011" }),
      "system",
      T0,
    );
    await repo.create(
      newEntry({ zohoProductId: "5003", stockCode: "LAX-ORI-PH-GAC-27-0099" }),
      "system",
      T0,
    );
    await repo.create(
      newEntry({ zohoProductId: "5004", stockCode: "LAX-ORI-PH-GAS-26-0500" }),
      "system",
      T0,
    );
    expect(await repo.highestStockNumber(series)).toBe(99);
    expect(await repo.highestStockNumber({ ...series, second: "GAS" })).toBe(500);
    expect(await repo.highestStockNumber({ ...series, kind: "print" })).toBeNull();
  });

  describe("issue", () => {
    const issueInput = (zohoProductId: string, collectionCode = "GAC") => ({
      zohoProductId,
      collectionCode,
      title: "Harbour at dusk",
      artist: { zohoArtistId: "77", name: "Aidan Phelan", code: "PH" },
      medium: null,
      dimensions: null,
      year: 2024,
      imageRefs: [],
      catalogueStatus: null,
    });

    it("numbers on across years instead of restarting", async () => {
      const first = await repo.issue("original", issueInput("6001"), "system", T0);
      const next = await repo.issue(
        "original",
        issueInput("6002"),
        "system",
        new Date("2027-02-01T10:00:00.000Z"),
      );
      expect(first).toMatchObject({ ok: true, entry: { stockCode: "LAX-ORI-PH-GAC-26-0001" } });
      expect(next).toMatchObject({ ok: true, entry: { stockCode: "LAX-ORI-PH-GAC-27-0002" } });
    });

    it("keeps separate runs per collection and per kind, and counts legacy PRI codes", async () => {
      await repo.issue("original", issueInput("6001"), "system", T0);
      const other = await repo.issue("original", issueInput("6002", "GAS"), "system", T0);
      expect(other).toMatchObject({ ok: true, entry: { stockCode: "LAX-ORI-PH-GAS-26-0001" } });
      await repo.create(
        newEntry({
          zohoProductId: "6003",
          stockCode: "LAX-PRI-PH-GAC-25-0012",
          kind: "print",
        }),
        "system",
        T0,
      );
      const print = await repo.issue("print", issueInput("6004"), "system", T0);
      expect(print).toMatchObject({ ok: true, entry: { stockCode: "LAX-PRT-PH-GAC-26-0013" } });
    });

    it("never hands the same number to concurrent calls", async () => {
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          repo.issue("original", issueInput(`7${i}`), "system", T0),
        ),
      );
      const codes = results.map((r) => (r.ok ? r.entry.stockCode : r.reason));
      expect(new Set(codes).size).toBe(8);
      expect([...codes].sort()).toEqual(
        Array.from({ length: 8 }, (_, i) => `LAX-ORI-PH-GAC-26-${String(i + 1).padStart(4, "0")}`),
      );
    });

    it("refuses artist and collection codes LAX would not issue", async () => {
      const badCollection = await repo.issue(
        "original",
        issueInput("6001", "TOOLONG"),
        "system",
        T0,
      );
      expect(badCollection).toMatchObject({ ok: false, reason: "invalid_code" });
      const badArtist = await repo.issue(
        "original",
        { ...issueInput("6002"), artist: { zohoArtistId: null, name: "A", code: "A" } },
        "system",
        T0,
      );
      expect(badArtist).toMatchObject({ ok: false, reason: "invalid_code" });
    });
  });

  describe("issuePrintGroup", () => {
    const printInput = (zohoProductId: string) => ({
      zohoProductId,
      title: "Harbour at dusk (print)",
      medium: null,
      dimensions: null,
      year: 2024,
      imageRefs: [],
      catalogueStatus: null,
    });

    it("mirrors the original's artist, collection, year and number", async () => {
      const original = await repo.issue(
        "original",
        {
          zohoProductId: "8001",
          collectionCode: "GAC",
          title: "Harbour at dusk",
          artist: { zohoArtistId: "77", name: "Aidan Phelan", code: "PH" },
          medium: null,
          dimensions: null,
          year: 2024,
          imageRefs: [],
          catalogueStatus: null,
        },
        "system",
        T0,
      );
      if (!original.ok) throw new Error(original.reason);
      const print = await repo.issuePrintGroup(
        original.entry.id,
        printInput("8002"),
        "system",
        new Date("2027-05-01T10:00:00.000Z"),
      );
      expect(print).toMatchObject({
        ok: true,
        entry: {
          stockCode: "LAX-PRT-PH-GAC-26-0001",
          kind: "print",
          sourceOriginalId: original.entry.id,
          artist: { code: "PH" },
        },
      });
      expect(
        await repo.issuePrintGroup(original.entry.id, printInput("8003"), "system", T0),
      ).toMatchObject({ ok: false, reason: "print_group_exists" });
    });

    it("fails clearly when the mirrored code belongs to another original's print", async () => {
      const original = await created();
      await repo.create(
        newEntry({
          zohoProductId: "8010",
          stockCode: "LAX-PRT-PH-GAC-26-0001",
          kind: "print",
          sourceOriginalId: null,
        }),
        "system",
        T0,
      );
      const result = await repo.issuePrintGroup(original.id, printInput("8011"), "system", T0);
      expect(result).toMatchObject({ ok: false, reason: "print_code_taken_by_other_original" });
    });

    it("refuses an unknown original or a print as the source", async () => {
      expect(
        await repo.issuePrintGroup(
          "00000000-0000-4000-8000-000000000000",
          printInput("8020"),
          "system",
          T0,
        ),
      ).toMatchObject({ ok: false, reason: "original_not_found" });
    });
  });

  describe("applyZohoChange", () => {
    it("applies Zoho-owned fields, bumps the version and records the change", async () => {
      const entry = await created();
      const result = await repo.applyZohoChange(
        { zohoProductId: "5001", modifiedAt: T1, fields: { title: "Harbour at dawn", year: 2025 } },
        T1,
      );
      expect(result.status).toBe("applied");
      if (result.status !== "applied") return;
      expect(result.applied.sort()).toEqual(["title", "year"]);
      expect(result.entry).toMatchObject({
        title: "Harbour at dawn",
        year: 2025,
        version: entry.version + 1,
        zohoModifiedAt: T1,
      });
      expect((await repo.listEvents(entry.id, 10)).map((e) => e.type)).toEqual([
        "created",
        "zoho_change_applied",
      ]);
    });

    it("applies the same notice once, however often it arrives", async () => {
      const entry = await created();
      const change = { zohoProductId: "5001", modifiedAt: T1, fields: { medium: "Acrylic" } };
      await repo.applyZohoChange(change, T1);
      const again = await repo.applyZohoChange(change, T2);
      expect(again.status).toBe("stale");
      expect((await repo.findById(entry.id))?.version).toBe(2);
      expect(await repo.listEvents(entry.id, 10)).toHaveLength(2);
    });

    it("never applies a LAX-owned field; it opens a conflict with both values", async () => {
      const entry = await created();
      const result = await repo.applyZohoChange(
        { zohoProductId: "5001", modifiedAt: T1, fields: { offerState: "sold", title: "New" } },
        T1,
      );
      expect(result.status === "applied" && result.conflicts).toEqual([
        { field: "offerState", zohoValue: "sold", laxValue: "held" },
      ]);
      expect((await repo.findById(entry.id))?.offer.state).toBe("held");

      const open = await repo.listOpenConflicts(10);
      expect(open).toHaveLength(1);
      expect(open[0]).toMatchObject({
        registerId: entry.id,
        field: "offerState",
        zohoValue: "sold",
        laxValue: "held",
        status: "open",
      });
    });

    it("keeps one open conflict per field, refreshed by a newer change", async () => {
      await created();
      await repo.applyZohoChange(
        { zohoProductId: "5001", modifiedAt: T1, fields: { offerState: "sold" } },
        T1,
      );
      await repo.applyZohoChange(
        { zohoProductId: "5001", modifiedAt: T2, fields: { offerState: "withdrawn" } },
        T2,
      );
      const open = await repo.listOpenConflicts(10);
      expect(open).toHaveLength(1);
      expect(open[0]?.zohoValue).toBe("withdrawn");
      expect(open[0]?.zohoModifiedAt).toEqual(T2);
    });

    it("reports an unknown Zoho product", async () => {
      expect(
        await repo.applyZohoChange({ zohoProductId: "nope", modifiedAt: T1, fields: {} }, T1),
      ).toEqual({ status: "not_found" });
    });
  });

  describe("moveOffer", () => {
    it("moves a held artwork to lax.art and records where it went", async () => {
      const entry = await created();
      const result = await repo.moveOffer({
        registerId: entry.id,
        expectedVersion: 1,
        to: "lax_art",
        ref: { kind: "shop_artwork", id: "shop-1" },
        actor: staff,
        now: T1,
      });
      expect(result.ok && result.entry.offer).toEqual({
        state: "lax_art",
        ref: { kind: "shop_artwork", id: "shop-1" },
      });
      expect(result.ok && result.entry.version).toBe(2);
      const events = await repo.listEvents(entry.id, 10);
      expect(events.at(-1)).toMatchObject({ type: "offer_moved", actor: staff });
    });

    it("moves between products only by withdrawing first", async () => {
      const entry = await created();
      const listed = await repo.moveOffer({
        registerId: entry.id,
        expectedVersion: 1,
        to: "lax_art",
        ref: { kind: "shop_artwork", id: "shop-1" },
        actor: staff,
        now: T1,
      });
      const direct = await repo.moveOffer({
        registerId: entry.id,
        expectedVersion: listed.ok ? listed.entry.version : 0,
        to: "bid_sale",
        ref: { kind: "bid_lot", id: "lot-1" },
        actor: staff,
        now: T1,
      });
      expect(direct).toEqual({ ok: false, reason: "not_allowed" });
    });

    it("refuses a move made from an out-of-date read", async () => {
      const entry = await created();
      await repo.applyZohoChange(
        { zohoProductId: "5001", modifiedAt: T1, fields: { title: "X" } },
        T1,
      );
      expect(
        await repo.moveOffer({
          registerId: entry.id,
          expectedVersion: 1,
          to: "withdrawn",
          ref: null,
          actor: staff,
          now: T2,
        }),
      ).toEqual({ ok: false, reason: "version_conflict" });
    });

    it("lets only one of two simultaneous moves win", async () => {
      const entry = await created();
      const attempt = (id: string) =>
        repo.moveOffer({
          registerId: entry.id,
          expectedVersion: 1,
          to: "lax_art",
          ref: { kind: "shop_artwork", id },
          actor: staff,
          now: T1,
        });
      const results = await Promise.all([attempt("a"), attempt("b")]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.find((r) => !r.ok)).toEqual({ ok: false, reason: "version_conflict" });
    });

    it("treats sold as final", async () => {
      const entry = await created();
      const listed = await repo.moveOffer({
        registerId: entry.id,
        expectedVersion: 1,
        to: "private_sale",
        ref: { kind: "private_sale", id: "deal-1" },
        actor: staff,
        now: T1,
      });
      const sold = await repo.moveOffer({
        registerId: entry.id,
        expectedVersion: listed.ok ? listed.entry.version : 0,
        to: "sold",
        ref: { kind: "private_sale", id: "deal-1" },
        actor: staff,
        now: T1,
      });
      expect(sold.ok).toBe(true);
      expect(
        await repo.moveOffer({
          registerId: entry.id,
          expectedVersion: sold.ok ? sold.entry.version : 0,
          to: "held",
          ref: null,
          actor: staff,
          now: T2,
        }),
      ).toEqual({ ok: false, reason: "sold_is_terminal" });
    });

    it("reports an unknown record", async () => {
      expect(
        await repo.moveOffer({
          registerId: "00000000-0000-4000-8000-000000000000",
          expectedVersion: 1,
          to: "withdrawn",
          ref: null,
          actor: staff,
          now: T1,
        }),
      ).toEqual({ ok: false, reason: "not_found" });
    });
  });

  describe("resolveConflict", () => {
    async function openConflict() {
      const entry = await created();
      await repo.applyZohoChange(
        { zohoProductId: "5001", modifiedAt: T1, fields: { offerState: "sold" } },
        T1,
      );
      const [found] = await repo.listOpenConflicts(10);
      if (!found) throw new Error("no conflict");
      return { entry, found };
    }

    it("resolves once, records who and why, and clears it from the queue", async () => {
      const { entry, found } = await openConflict();
      const result = await repo.resolveConflict({
        conflictId: found.id,
        resolution: "kept_lax",
        resolvedBy: staff,
        now: T2,
      });
      expect(result.ok && result.conflict).toMatchObject({
        status: "resolved",
        resolution: "kept_lax",
        resolvedBy: staff,
      });
      expect(await repo.listOpenConflicts(10)).toEqual([]);
      expect((await repo.listEvents(entry.id, 10)).at(-1)?.type).toBe("conflict_resolved");
      expect(
        await repo.resolveConflict({
          conflictId: found.id,
          resolution: "kept_lax",
          resolvedBy: staff,
          now: T2,
        }),
      ).toEqual({ ok: false, reason: "already_resolved" });
    });

    it("lets a later Zoho change open a new conflict on the same field", async () => {
      const { found } = await openConflict();
      await repo.resolveConflict({
        conflictId: found.id,
        resolution: "kept_lax",
        resolvedBy: staff,
        now: T1,
      });
      await repo.applyZohoChange(
        { zohoProductId: "5001", modifiedAt: T2, fields: { offerState: "withdrawn" } },
        T2,
      );
      expect(await repo.listOpenConflicts(10)).toHaveLength(1);
    });

    async function stockConflict(zohoCode: string) {
      const entry = await created();
      await repo.applyZohoChange(
        { zohoProductId: "5001", modifiedAt: T2, fields: { stockCode: zohoCode } },
        T2,
      );
      const [open] = await repo.listOpenConflicts(10);
      if (!open) throw new Error("no conflict");
      return { entry, open };
    }
    const accept = (conflictId: string) =>
      repo.resolveConflict({ conflictId, resolution: "accepted_zoho", resolvedBy: staff, now: T2 });

    it("applies Zoho's stock code when it is accepted, in the same step", async () => {
      const { entry, open } = await stockConflict("LAX-ORI-PH-GAC-26-0099");
      expect(await accept(open.id)).toMatchObject({ ok: true });
      const after = await repo.findById(entry.id);
      expect(after?.stockCode).toBe("LAX-ORI-PH-GAC-26-0099");
      expect(after?.version).toBe(entry.version + 1);
      expect(await repo.listOpenConflicts(10)).toHaveLength(0);
      const events = await repo.listEvents(entry.id, 10);
      // The conflict and its decision share a timestamp here, so pick the event by type.
      expect(events.find((e) => e.type === "conflict_resolved")?.payload).toMatchObject({
        resolution: "accepted_zoho",
        applied: { from: "LAX-ORI-PH-GAC-26-0001", to: "LAX-ORI-PH-GAC-26-0099" },
      });
    });

    it("refuses a stock code another artwork holds, and keeps the conflict open", async () => {
      const { entry, open } = await stockConflict("LAX-ORI-PH-GAC-26-0099");
      await repo.create(
        newEntry({ zohoProductId: "5002", stockCode: "LAX-ORI-PH-GAC-26-0099" }),
        "system",
        T0,
      );
      expect(await accept(open.id)).toEqual({ ok: false, reason: "stock_code_taken" });
      expect((await repo.findById(entry.id))?.stockCode).toBe("LAX-ORI-PH-GAC-26-0001");
      expect(await repo.listOpenConflicts(10)).toHaveLength(1);
    });

    it("refuses a stock code that is not a LAX code or would make a print of an original", async () => {
      const bad = await stockConflict("not-a-code");
      expect(await accept(bad.open.id)).toEqual({ ok: false, reason: "invalid_stock_code" });
      await repo.applyZohoChange(
        {
          zohoProductId: "5001",
          modifiedAt: new Date(T2.getTime() + 1000),
          fields: { stockCode: "LAX-PRI-PH-GAC-26-0001" },
        },
        T2,
      );
      const [open] = await repo.listOpenConflicts(10);
      expect(await accept(open?.id ?? "")).toEqual({ ok: false, reason: "invalid_stock_code" });
      expect(await repo.listOpenConflicts(10)).toHaveLength(1);
    });

    it("never accepts Zoho's value for where an artwork is offered", async () => {
      await created();
      await repo.applyZohoChange(
        { zohoProductId: "5001", modifiedAt: T2, fields: { offerState: "withdrawn" } },
        T2,
      );
      const [open] = await repo.listOpenConflicts(10);
      expect(await accept(open?.id ?? "")).toEqual({ ok: false, reason: "cannot_accept_field" });
    });

    it("reports an unknown conflict", async () => {
      expect(
        await repo.resolveConflict({
          conflictId: "00000000-0000-4000-8000-000000000000",
          resolution: "kept_lax",
          resolvedBy: staff,
          now: T1,
        }),
      ).toEqual({ ok: false, reason: "not_found" });
    });
  });

  describe("domain events for the Zoho writeback", () => {
    async function published() {
      const result = await db.execute(
        sql`SELECT event_type, aggregate_id, producer, payload FROM domain_events
            WHERE aggregate_type = 'artwork_register' ORDER BY id`,
      );
      return result.rows as {
        event_type: string;
        aggregate_id: string;
        producer: string;
        payload: Record<string, unknown>;
      }[];
    }

    beforeEach(async () => {
      await db.execute(sql`DELETE FROM domain_events WHERE aggregate_type = 'artwork_register'`);
    });

    it("publishes the stock code when LAX creates an entry", async () => {
      const entry = await created();
      expect(await published()).toEqual([
        {
          event_type: "artwork_register.stock_code_assigned",
          aggregate_id: entry.id,
          producer: "packages/db",
          payload: {
            schemaVersion: 1,
            registerId: entry.id,
            zohoProductId: "5001",
            stockCode: "LAX-ORI-PH-GAC-26-0001",
          },
        },
      ]);
    });

    it("publishes nothing for an entry that came from Zoho, which already holds its code", async () => {
      const result = await repo.create(newEntry(), "zoho", T0);
      expect(result.ok).toBe(true);
      expect(await published()).toEqual([]);
    });

    it("publishes the move in the same transaction as the move itself", async () => {
      const entry = await created();
      await repo.moveOffer({
        registerId: entry.id,
        expectedVersion: 1,
        to: "lax_art",
        ref: { kind: "shop_artwork", id: "shop-1" },
        actor: staff,
        now: T1,
      });
      const moves = (await published()).filter(
        (e) => e.event_type === "artwork_register.offer_changed",
      );
      expect(moves).toHaveLength(1);
      expect(moves[0]?.payload).toEqual({
        schemaVersion: 1,
        registerId: entry.id,
        zohoProductId: "5001",
        stockCode: "LAX-ORI-PH-GAC-26-0001",
        fromState: "held",
        toState: "lax_art",
      });
    });

    it("publishes nothing for a refused move", async () => {
      const entry = await created();
      const before = (await published()).length;
      await repo.moveOffer({
        registerId: entry.id,
        expectedVersion: 99,
        to: "lax_art",
        ref: { kind: "shop_artwork", id: "shop-1" },
        actor: staff,
        now: T1,
      });
      expect((await published()).length).toBe(before);
    });
  });

  describe("recordCatalogueStatusWritten", () => {
    it("holds the written Status without moving the version, and records it", async () => {
      const entry = await created();
      expect(
        await repo.recordCatalogueStatusWritten({
          registerId: entry.id,
          status: "In Auction",
          now: T1,
        }),
      ).toEqual({ status: "recorded" });
      const after = await repo.findById(entry.id);
      expect(after?.catalogueStatus).toBe("In Auction");
      expect(after?.version).toBe(entry.version);
      expect((await repo.listEvents(entry.id, 10)).at(-1)).toMatchObject({
        type: "zoho_writeback_recorded",
        actor: "system",
        payload: { field: "catalogueStatus", from: "Available", to: "In Auction" },
      });
    });

    it("does nothing when the register already holds that Status, and for an unknown entry", async () => {
      const entry = await created();
      expect(
        await repo.recordCatalogueStatusWritten({
          registerId: entry.id,
          status: "Available",
          now: T1,
        }),
      ).toEqual({ status: "unchanged" });
      expect(
        await repo.recordCatalogueStatusWritten({
          registerId: "00000000-0000-4000-8000-000000000000",
          status: "Sold",
          now: T1,
        }),
      ).toEqual({ status: "not_found" });
    });

    it("leaves an optimistic move unaffected", async () => {
      const entry = await created();
      await repo.recordCatalogueStatusWritten({
        registerId: entry.id,
        status: "Reserved",
        now: T1,
      });
      const moved = await repo.moveOffer({
        registerId: entry.id,
        expectedVersion: entry.version,
        to: "withdrawn",
        ref: null,
        actor: staff,
        now: T2,
      });
      expect(moved.ok).toBe(true);
    });
  });

  it("refuses to change or delete history", async () => {
    const entry = await created();
    await expect(
      db.execute(
        sql`UPDATE artwork_register_event SET actor = 'x' WHERE register_id = ${entry.id}`,
      ),
    ).rejects.toThrow();
    await expect(
      db.execute(sql`DELETE FROM artwork_register_event WHERE register_id = ${entry.id}`),
    ).rejects.toThrow();
  });

  describe("Zoho pictures", () => {
    const source = (id: string) => ({
      zohoFileId: id,
      fingerprint: "10:t",
      sha256: id.repeat(64).slice(0, 64),
      key: `shop/artwork/zoho-${id}.jpg`,
    });

    it("replaces the pictures, keeps imageRefs as their distinct keys and records it once", async () => {
      const entry = await created();
      const same = { ...source("b"), zohoFileId: "other-file" };
      const result = await repo.replaceZohoImages({
        zohoProductId: "5001",
        sources: [source("a"), source("b"), same],
        now: T1,
      });
      expect(result.status).toBe("replaced");
      const after = await repo.findById(entry.id);
      expect(after?.imageRefs).toEqual(["shop/artwork/zoho-a.jpg", "shop/artwork/zoho-b.jpg"]);
      expect(after?.version).toBe(entry.version + 1);
      expect(await repo.findImageSources("5001")).toEqual([source("a"), source("b"), same]);

      const again = await repo.replaceZohoImages({
        zohoProductId: "5001",
        sources: [source("a"), source("b"), same],
        now: T2,
      });
      expect(again.status).toBe("unchanged");
      expect((await repo.findById(entry.id))?.version).toBe(entry.version + 1);
      const types = (await repo.listEvents(entry.id, 10)).map((e) => e.type);
      expect(types.filter((t) => t === "zoho_change_applied")).toHaveLength(1);
    });

    it("clears the pictures when Zoho has none, and answers not_found for an unknown Product", async () => {
      await created();
      await repo.replaceZohoImages({ zohoProductId: "5001", sources: [source("a")], now: T1 });
      expect(
        (await repo.replaceZohoImages({ zohoProductId: "5001", sources: [], now: T2 })).status,
      ).toBe("replaced");
      expect((await repo.findByZohoProductId("5001"))?.imageRefs).toEqual([]);
      expect(
        (await repo.replaceZohoImages({ zohoProductId: "nope", sources: [], now: T2 })).status,
      ).toBe("not_found");
      expect(await repo.findImageSources("nope")).toBeNull();
    });

    it("lists originals never checked first, then those checked longest ago, and skips fresh ones", async () => {
      await created();
      await repo.create(
        newEntry({ zohoProductId: "5002", stockCode: "LAX-ORI-PH-GAC-26-0002", imageRefs: [] }),
        "system",
        T0,
      );
      await repo.create(
        newEntry({ zohoProductId: "5003", stockCode: "LAX-ORI-PH-GAC-26-0003", imageRefs: [] }),
        "system",
        T0,
      );
      await repo.replaceZohoImages({ zohoProductId: "5002", sources: [], now: T0 });
      await repo.replaceZohoImages({ zohoProductId: "5003", sources: [], now: T2 });
      const due = await repo.listImageCheckCandidates(T1, 10);
      expect(due.map((c) => c.zohoProductId)).toEqual(["5001", "5002"]);
      expect(await repo.listImageCheckCandidates(T1, 1)).toHaveLength(1);
    });

    it("never lists a print", async () => {
      const original = await created();
      const print = await repo.create(
        newEntry({
          zohoProductId: "5009",
          stockCode: "LAX-PRI-PH-GAC-26-0009",
          kind: "print",
          sourceOriginalId: original.id,
          imageRefs: [],
        }),
        "system",
        T0,
      );
      expect(print.ok).toBe(true);
      const due = await repo.listImageCheckCandidates(T2, 10);
      expect(due.map((c) => c.zohoProductId)).toEqual(["5001"]);
    });
  });
});
