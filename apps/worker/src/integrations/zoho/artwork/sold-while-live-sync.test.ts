import type { ArtworkRegisterEntry, OfferState } from "@auction/artwork-register-contracts";
import type {
  ISoldAttentionStore,
  RaiseSoldAttentionInput,
  SoldAttentionLiveCursor,
  SoldAttentionRecord,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { product } from "./fixtures/load-fixtures.js";
import { type GallerySaleMode, GallerySaleRecorder } from "./gallery-sale.js";
import { SoldWhileLiveMonitor } from "./sold-while-live-monitor.js";
import { ZohoArtworkSyncService } from "./zoho-artwork-sync-service.js";

const NOW = new Date("2026-11-03T02:30:00.000Z");
const MARKED = new Date("2026-11-02T16:00:00.000Z");
const PRODUCT = product(1);

function entry(
  catalogueStatus: string | null,
  state: OfferState,
  kind: "original" | "print" = "original",
): ArtworkRegisterEntry {
  return {
    id: "reg-1",
    zohoProductId: PRODUCT.id,
    stockCode: "LAX-ORI-PH-GAC-26-0001",
    kind,
    sourceOriginalId: null,
    title: "Blue Door",
    artist: { zohoArtistId: null, name: "Pat Hand", code: "PH" },
    medium: null,
    dimensions: null,
    year: null,
    imageRefs: [],
    catalogueStatus,
    offer: { state, ref: state === "held" ? null : { kind: "shop_artwork", id: "shop-1" } },
    zohoModifiedAt: MARKED,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

/** Keeps items in memory with the same one-live-item-per-artwork-and-status rule as the table. */
class InMemoryAttention implements ISoldAttentionStore {
  items: SoldAttentionRecord[] = [];
  async findLive(registerId: string) {
    return this.items.find((i) => i.registerId === registerId && i.status !== "resolved") ?? null;
  }
  async raise(input: RaiseSoldAttentionInput) {
    const taken = this.items.some(
      (i) =>
        i.registerId === input.registerId &&
        i.zohoStatus === input.zohoStatus &&
        i.status !== "resolved",
    );
    if (taken) return { raised: false };
    this.items.push({
      id: `att-${this.items.length + 1}`,
      ...input,
      status: "open",
      resolution: null,
      resolvedBy: null,
      overrideReason: null,
      raisedAt: input.now,
      resolvedAt: null,
    });
    return { raised: true };
  }
  async resolve(input: { id: string; resolution: SoldAttentionRecord["resolution"]; now: Date }) {
    const item = this.items.find((i) => i.id === input.id && i.status !== "resolved");
    if (!item) return false;
    Object.assign(item, {
      status: "resolved",
      resolution: input.resolution,
      resolvedAt: input.now,
    });
    return true;
  }
  async override() {
    return { ok: false as const, reason: "not_found" as const };
  }
  async markDealtWith(input: { id: string; actor: string; now: Date }) {
    const item = this.items.find((i) => i.id === input.id && i.status === "open");
    if (!item) return { ok: false as const, reason: "not_open" as const };
    Object.assign(item, {
      status: "resolved",
      resolution: "staff_resolved",
      resolvedBy: input.actor,
      resolvedAt: input.now,
    });
    return { ok: true as const, item };
  }
  async listOpen() {
    return [];
  }
  async countOpen() {
    return this.items.filter((i) => i.status === "open").length;
  }
  replaces = 0;
  async replace(input: { id: string; now: Date; raise: RaiseSoldAttentionInput }) {
    this.replaces += 1;
    const closed = await this.resolve({ id: input.id, resolution: "replaced", now: input.now });
    const raised = await this.raise(input.raise);
    return closed && raised.raised;
  }
  async listLive(limit: number, after?: SoldAttentionLiveCursor) {
    return this.items
      .filter((i) => i.status !== "resolved")
      .map((i) => ({ id: i.id, registerId: i.registerId, raisedAt: i.raisedAt }))
      .filter((i) => !after || i.id > after.id)
      .slice(0, limit);
  }
  async isPaused() {
    return this.items.some((i) => i.status === "open");
  }
}

function setup(
  mode: "live" | "dry_run",
  current: ArtworkRegisterEntry,
  gallery: GallerySaleMode | null = null,
  zohoProduct = PRODUCT,
) {
  let held = current;
  const attention = new InMemoryAttention();
  const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn() };
  const register = {
    findByZohoProductId: vi.fn(async () => held),
    findById: vi.fn(async () => held),
    findByStockCode: vi.fn(async () => held),
    create: vi.fn(),
    applyZohoChange: vi.fn(async () => ({ status: "applied" })),
    /** As the repository does: decided again from the record, so a repeat records nothing. */
    recordGallerySale: vi.fn(async () => {
      const sold = held.catalogueStatus?.trim().toLowerCase() === "sold";
      if (!sold || !["held", "withdrawn", "lax_art"].includes(held.offer.state)) {
        return { status: "unchanged", entry: held, plan: { action: "none" } };
      }
      const from = held.offer.state;
      const laxArtListingId = from === "lax_art" ? (held.offer.ref?.id ?? null) : null;
      held = {
        ...held,
        offer: { state: "sold", ref: { kind: "gallery_sale", id: held.zohoProductId } },
        version: held.version + 1,
      };
      return { status: "recorded", entry: held, from, laxArtListingId };
    }),
    listGallerySaleCandidates: vi.fn(async (_limit: number, after?: string) => {
      const sold = held.catalogueStatus?.trim().toLowerCase() === "sold";
      return sold && !after && ["held", "withdrawn", "lax_art"].includes(held.offer.state)
        ? [held.id]
        : [];
    }),
  };
  const monitor = new SoldWhileLiveMonitor(attention, register as never);
  const report = { record: vi.fn(), summarise: vi.fn(async () => ({})) };
  const service = new ZohoArtworkSyncService({
    mode,
    reader: {
      fetchProduct: vi.fn(async () => zohoProduct),
      fetchModifiedSince: vi.fn(async function* () {
        yield [zohoProduct];
      }),
    },
    images: { syncProduct: vi.fn(async () => ({ status: "checked", changed: false }) as never) },
    imageCheck: { listImageCheckCandidates: vi.fn(async () => []) } as never,
    register: register as never,
    report: report as never,
    watermark: { get: vi.fn(async () => null), advance: vi.fn() } as never,
    soldWhileLive: monitor,
    ...(gallery
      ? {
          gallerySales: new GallerySaleRecorder({
            mode: gallery,
            register: register as never,
            soldWhileLive: monitor,
            log: log as never,
          }),
        }
      : {}),
    log: log as never,
    now: () => NOW,
  });
  const notice = (runId: string) => service.processNotice({ productId: PRODUCT.id, runId });
  return {
    attention,
    register,
    report,
    log,
    current: () => held,
    notice,
    nightly: () => service.runNightly(),
    zohoNowSays: (next: ArtworkRegisterEntry) => {
      held = next;
    },
  };
}

describe("Zoho Sold or Reserved on an artwork that is still for sale", () => {
  it.each([
    ["Sold", "lax_art"],
    ["Reserved", "lax_art"],
    ["Sold", "bid_sale"],
    ["Sold", "private_sale"],
  ] as const)("raises one item when a notice says %s while %s", async (status, state) => {
    const t = setup("live", entry(status, state));
    await t.notice("notice:1");
    await t.notice("notice:2");
    expect(t.attention.items).toHaveLength(1);
    expect(t.attention.items[0]).toMatchObject({
      registerId: "reg-1",
      zohoStatus: status,
      place: state,
      placeRefId: "shop-1",
      markedAt: MARKED,
      status: "open",
    });
  });

  it("raises it from the nightly check too, once however often it runs", async () => {
    const t = setup("live", entry("Sold", "lax_art"));
    await t.nightly();
    await t.nightly();
    expect(t.attention.items).toHaveLength(1);
  });

  it.each(["held", "withdrawn", "sold"] as const)(
    "raises nothing when the artwork is %s",
    async (state) => {
      const t = setup("live", entry("Sold", state));
      await t.notice("notice:1");
      expect(t.attention.items).toEqual([]);
    },
  );

  it("raises nothing for a print, or when Zoho says Available", async () => {
    const print = setup("live", entry("Sold", "lax_art", "print"));
    await print.notice("notice:1");
    const available = setup("live", entry("Available", "lax_art"));
    await available.notice("notice:1");
    expect(print.attention.items).toEqual([]);
    expect(available.attention.items).toEqual([]);
  });

  it("raises nothing in a dry run", async () => {
    const t = setup("dry_run", entry("Sold", "lax_art"));
    await t.notice("notice:1");
    expect(t.attention.items).toEqual([]);
  });

  it("resolves the item when Zoho goes back to Available", async () => {
    const t = setup("live", entry("Sold", "lax_art"));
    await t.notice("notice:1");
    t.zohoNowSays(entry("Available", "lax_art"));
    await t.notice("notice:2");
    expect(t.attention.items[0]).toMatchObject({
      status: "resolved",
      resolution: "zoho_status_changed",
      resolvedAt: NOW,
    });
  });

  it("resolves the item in the nightly sweep once the listing is withdrawn", async () => {
    const t = setup("live", entry("Sold", "lax_art"));
    await t.notice("notice:1");
    t.zohoNowSays(entry("Sold", "withdrawn"));
    await t.nightly();
    expect(t.attention.items[0]).toMatchObject({ status: "resolved", resolution: "withdrawn" });
  });

  it("replaces a Sold item with a Reserved one when Zoho changes its mind", async () => {
    const t = setup("live", entry("Sold", "lax_art"));
    await t.notice("notice:1");
    t.zohoNowSays(entry("Reserved", "lax_art"));
    await t.notice("notice:2");
    expect(t.attention.items.map((i) => [i.zohoStatus, i.status, i.resolution])).toEqual([
      ["Sold", "resolved", "replaced"],
      ["Reserved", "open", null],
    ]);
  });

  it("replaces in one step, never leaving a moment with nothing open", async () => {
    const t = setup("live", entry("Sold", "lax_art"));
    await t.notice("notice:1");
    t.zohoNowSays(entry("Reserved", "lax_art"));
    await t.notice("notice:2");
    expect(t.attention.replaces).toBe(1);
    expect(await t.attention.isPaused()).toBe(true);
  });

  it("does not raise an item or pause money for LAX's own Reserved on a private sale", async () => {
    const t = setup("live", entry("Reserved", "private_sale"));
    await t.notice("notice:1");
    await t.nightly();
    expect(t.attention.items).toEqual([]);
    expect(await t.attention.isPaused()).toBe(false);
  });

  it("still raises for Zoho saying Sold on a private sale", async () => {
    const t = setup("live", entry("Sold", "private_sale"));
    await t.notice("notice:1");
    expect(t.attention.items).toHaveLength(1);
  });

  it("closes an item as sold in LAX when the artwork then sells on LAX", async () => {
    const t = setup("live", entry("Sold", "lax_art"));
    await t.notice("notice:1");
    t.zohoNowSays(entry("Sold", "sold"));
    await t.nightly();
    expect(t.attention.items[0]).toMatchObject({ status: "resolved", resolution: "sold_in_lax" });
  });

  it("sweeps past the first page of live items", async () => {
    const attention = new InMemoryAttention();
    const held = entry("Available", "lax_art");
    for (let n = 1; n <= 5; n += 1) {
      await attention.raise({
        registerId: `reg-${n}`,
        zohoProductId: `p-${n}`,
        zohoStatus: "Sold",
        place: "lax_art",
        placeRefId: null,
        markedAt: MARKED,
        now: NOW,
      });
    }
    const monitor = new SoldWhileLiveMonitor(attention, {
      findById: vi.fn(async (id: string) => ({ ...held, id })),
    } as never);
    expect(await monitor.sweep(NOW, 2)).toBe(5);
    expect(attention.items.every((i) => i.status === "resolved")).toBe(true);
  });

  it("does not fail the Product when the check cannot run", async () => {
    const t = setup("live", entry("Sold", "lax_art"));
    t.attention.findLive = vi.fn().mockRejectedValue(new Error("database unavailable"));
    await expect(t.notice("notice:1")).resolves.toMatchObject({ ran: true });
  });
});

describe("Zoho Sold recorded as a sale in the gallery", () => {
  it("takes it off lax.art, holds payments and raises the staff item, once", async () => {
    const t = setup("live", entry("Sold", "lax_art"), "live");
    await t.notice("notice:1");
    expect(t.current().offer).toEqual({
      state: "sold",
      ref: { kind: "gallery_sale", id: PRODUCT.id },
    });
    expect(t.attention.items).toHaveLength(1);
    expect(t.attention.items[0]).toMatchObject({ place: "lax_art", status: "open" });
    expect(await t.attention.isPaused()).toBe(true);
    const detail = t.report.record.mock.calls[0]?.[2]?.[0]?.detail;
    expect(detail.gallerySale).toEqual({
      action: "recorded",
      from: "lax_art",
      laxArtListingId: "shop-1",
    });

    // Repeated notices and the nightly pass change nothing and keep payments held.
    await t.notice("notice:2");
    await t.nightly();
    expect(t.register.recordGallerySale).toHaveBeenCalledTimes(1);
    expect(t.attention.items).toHaveLength(1);
    expect(t.attention.items[0]?.status).toBe("open");
    expect(await t.attention.isPaused()).toBe(true);
  });

  it("closes the item only when staff mark it dealt with", async () => {
    const t = setup("live", entry("Sold", "lax_art"), "live");
    await t.notice("notice:1");
    const id = t.attention.items[0]?.id ?? "";
    await t.attention.markDealtWith({ id, actor: "staff:s1", now: NOW });
    expect(await t.attention.isPaused()).toBe(false);
    await t.nightly();
    expect(t.attention.items).toHaveLength(1);
  });

  it("records a held artwork as sold without raising an item", async () => {
    const t = setup("live", entry("Sold", "held"), "live");
    await t.notice("notice:1");
    expect(t.current().offer.state).toBe("sold");
    expect(t.attention.items).toEqual([]);
  });

  it("leaves a Bid lot or private sale to staff, then records it once withdrawn", async () => {
    const t = setup("live", entry("Sold", "bid_sale"), "live");
    await t.notice("notice:1");
    expect(t.current().offer.state).toBe("bid_sale");
    expect(t.register.recordGallerySale).not.toHaveBeenCalled();
    expect(t.attention.items[0]).toMatchObject({ place: "bid_sale", status: "open" });

    t.zohoNowSays(entry("Sold", "withdrawn"));
    await t.nightly();
    expect(t.current().offer.state).toBe("sold");
  });

  it("writes nothing in a dry run, and logs what it would record", async () => {
    for (const [sync, gallery] of [
      ["dry_run", "dry_run"],
      ["live", "dry_run"],
    ] as const) {
      // In a dry run sync the register keeps its old Status; the Sold comes from Zoho's read.
      const t = setup(sync, entry(sync === "live" ? "Sold" : "Available", "lax_art"), gallery, {
        ...PRODUCT,
        status: "Sold",
      });
      await t.notice("notice:1");
      await t.nightly();
      expect(t.register.recordGallerySale).not.toHaveBeenCalled();
      expect(t.current().offer.state).toBe("lax_art");
      expect(t.log.info).toHaveBeenCalledWith(
        expect.objectContaining({ from: "lax_art", laxArtListingId: "shop-1" }),
        "zoho_gallery_sale_dry_run",
      );
    }
  });

  it("does nothing when the gallery sale is off", async () => {
    const t = setup("live", entry("Sold", "lax_art"), "off");
    await t.notice("notice:1");
    await t.nightly();
    expect(t.register.recordGallerySale).not.toHaveBeenCalled();
  });
});
