import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleSoldAttentionStore,
  DrizzleZohoArtworkSyncStore,
} from "@auction/persistence/repositories";
import { sql } from "drizzle-orm";
import type { Logger } from "pino";
import { afterAll, describe, expect, it, vi } from "vitest";
import { assessProduct } from "./assess-product.js";
import type { CatalogueProduct } from "./catalogue-product.js";
import { product } from "./fixtures/load-fixtures.js";
import { type GallerySaleMode, GallerySaleRecorder } from "./gallery-sale.js";
import { SoldWhileLiveMonitor } from "./sold-while-live-monitor.js";
import { ZohoArtworkSyncService } from "./zoho-artwork-sync-service.js";

const url = process.env.DATABASE_URL;
const db = url ? createDb(url) : (null as never);

const LISTED = new Date("2026-11-10T09:00:00.000Z");
const MARKED = new Date("2026-11-15T09:30:00.000Z");
const NOW = new Date("2026-11-15T10:00:00.000Z");

const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as Logger;

describe.skipIf(!url)(
  "Zoho Sold becomes a sale in the gallery (Postgres)",
  { timeout: 30_000 },
  () => {
    const register = new DrizzleArtworkRegisterRepository(db);
    const attention = new DrizzleSoldAttentionStore(db);
    const created: string[] = [];

    afterAll(async () => {
      for (const id of created) {
        await db.execute(
          sql`DELETE FROM artwork_register_sold_attention WHERE register_id = ${id}`,
        );
      }
    });

    /** A record made from a Zoho Product, on lax.art at `shop-<n>`; and that Product, now Sold. */
    async function listedOnLaxArt(): Promise<{ id: string; sold: CatalogueProduct }> {
      const n = Math.floor(Math.random() * 9000) + 1000;
      const base = product(1);
      const available: CatalogueProduct = {
        ...base,
        id: `gs-${randomUUID()}`,
        stockCode: `LAX-ORI-${base.stockCode?.split("-")[2] ?? "PH"}-GAL-26-${n}`,
        status: "Available",
        modifiedAt: LISTED,
      };
      const entry = assessProduct(available).newEntry;
      if (!entry) throw new Error("fixture product cannot be created");
      const made = await register.create(entry, "zoho", LISTED);
      if (!made.ok) throw new Error(made.reason);
      created.push(made.entry.id);
      const moved = await register.moveOffer({
        registerId: made.entry.id,
        expectedVersion: made.entry.version,
        to: "lax_art",
        ref: { kind: "shop_artwork", id: `shop-${n}` },
        actor: "staff:s1",
        now: LISTED,
      });
      if (!moved.ok) throw new Error(moved.reason);
      return { id: made.entry.id, sold: { ...available, status: "Sold", modifiedAt: MARKED } };
    }

    function sync(mode: "dry_run" | "live", gallery: GallerySaleMode, zoho: CatalogueProduct) {
      const store = new DrizzleZohoArtworkSyncStore(db);
      const soldWhileLive = new SoldWhileLiveMonitor(attention, register);
      return new ZohoArtworkSyncService({
        mode,
        reader: {
          fetchProduct: async () => zoho,
          fetchModifiedSince: async function* () {},
        } as never,
        images: { syncProduct: async () => ({ status: "checked", changed: false }) as never },
        imageCheck: { listImageCheckCandidates: async () => [] } as never,
        register,
        report: store,
        watermark: store,
        soldWhileLive,
        gallerySales: new GallerySaleRecorder({ mode: gallery, register, soldWhileLive, log }),
        log,
        now: () => NOW,
      });
    }

    const notice = (service: ZohoArtworkSyncService, productId: string) =>
      service.processNotice({ productId, runId: `notice:${randomUUID()}` });

    async function events(registerId: string, type: string) {
      return (await register.listEvents(registerId, 50)).filter((e) => e.type === type);
    }

    it("records the sale, holds payments and raises the staff item; repeating changes nothing", async () => {
      const { id, sold } = await listedOnLaxArt();
      const live = sync("live", "live", sold);

      await notice(live, sold.id);
      const after = await register.findById(id);
      expect(after?.catalogueStatus).toBe("Sold");
      expect(after?.offer).toEqual({ state: "sold", ref: { kind: "gallery_sale", id: sold.id } });
      expect(await attention.isPaused({ registerId: id })).toBe(true);
      const item = await attention.findLive(id);
      expect(item).toMatchObject({ status: "open", place: "lax_art", zohoStatus: "Sold" });

      await notice(live, sold.id);
      await live.runNightly();
      expect((await register.findById(id))?.version).toBe(after?.version);
      expect(await events(id, "gallery_sale_recorded")).toHaveLength(1);
      expect(await events(id, "sold_while_live_raised")).toHaveLength(1);
      expect((await attention.findLive(id))?.id).toBe(item?.id);
      expect(await attention.isPaused({ registerId: id })).toBe(true);
    });

    it("writes nothing in a dry run", async () => {
      const { id, sold } = await listedOnLaxArt();
      const before = await register.findById(id);
      await notice(sync("dry_run", "dry_run", sold), sold.id);
      await sync("dry_run", "dry_run", sold).runNightly();
      const after = await register.findById(id);
      expect(after).toEqual(before);
      expect(await attention.findLive(id)).toBeNull();
      expect(await events(id, "gallery_sale_recorded")).toEqual([]);
    });

    it("with the sync live and the listing mode in dry run, records nothing about the sale", async () => {
      const { id, sold } = await listedOnLaxArt();
      await notice(sync("live", "dry_run", sold), sold.id);
      expect((await register.findById(id))?.offer.state).toBe("lax_art");
      expect(await events(id, "gallery_sale_recorded")).toEqual([]);
    });

    it("Reopen restores the artwork once Zoho no longer says Sold, and the sync leaves it", async () => {
      const { id, sold } = await listedOnLaxArt();
      await notice(sync("live", "live", sold), sold.id);
      const item = await attention.findLive(id);
      await attention.markDealtWith({ id: item?.id ?? "", actor: "staff:s1", now: NOW });

      const corrected: CatalogueProduct = {
        ...sold,
        status: "Available",
        modifiedAt: new Date(MARKED.getTime() + 60_000),
      };
      await notice(sync("live", "live", corrected), sold.id);
      expect((await register.findById(id))?.offer.state).toBe("sold");

      const reopened = await register.reopenGallerySale({
        registerId: id,
        reason: "Marked Sold on the wrong Product",
        actor: "staff:admin",
        now: NOW,
      });
      expect(reopened.ok).toBe(true);
      expect((await register.findById(id))?.offer).toEqual({ state: "held", ref: null });

      await notice(sync("live", "live", corrected), sold.id);
      expect((await register.findById(id))?.offer).toEqual({ state: "held", ref: null });
      expect(await attention.isPaused({ registerId: id })).toBe(false);
    });
  },
);
