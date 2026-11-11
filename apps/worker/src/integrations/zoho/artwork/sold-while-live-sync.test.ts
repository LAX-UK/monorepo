import type { ArtworkRegisterEntry, OfferState } from "@auction/artwork-register-contracts";
import type {
  ISoldAttentionStore,
  RaiseSoldAttentionInput,
  SoldAttentionRecord,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { product } from "./fixtures/load-fixtures.js";
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
  async listOpen() {
    return [];
  }
  async countOpen() {
    return this.items.filter((i) => i.status === "open").length;
  }
  async listLiveRegisterIds() {
    return this.items.filter((i) => i.status !== "resolved").map((i) => i.registerId);
  }
  async isPaused() {
    return this.items.some((i) => i.status === "open");
  }
}

function setup(mode: "live" | "dry_run", current: ArtworkRegisterEntry) {
  let held = current;
  const attention = new InMemoryAttention();
  const register = {
    findByZohoProductId: vi.fn(async () => held),
    findById: vi.fn(async () => held),
    findByStockCode: vi.fn(async () => held),
    create: vi.fn(),
    applyZohoChange: vi.fn(async () => ({ status: "applied" })),
  };
  const service = new ZohoArtworkSyncService({
    mode,
    reader: {
      fetchProduct: vi.fn(async () => PRODUCT),
      fetchModifiedSince: vi.fn(async function* () {
        yield [PRODUCT];
      }),
    },
    images: { syncProduct: vi.fn(async () => ({ status: "checked", changed: false }) as never) },
    imageCheck: { listImageCheckCandidates: vi.fn(async () => []) } as never,
    register: register as never,
    report: { record: vi.fn(), summarise: vi.fn(async () => ({})) } as never,
    watermark: { get: vi.fn(async () => null), advance: vi.fn() } as never,
    soldWhileLive: new SoldWhileLiveMonitor(attention, register),
    log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn() } as never,
    now: () => NOW,
  });
  const notice = (runId: string) => service.processNotice({ productId: PRODUCT.id, runId });
  return {
    attention,
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

  it("does not fail the Product when the check cannot run", async () => {
    const t = setup("live", entry("Sold", "lax_art"));
    t.attention.findLive = vi.fn().mockRejectedValue(new Error("database unavailable"));
    await expect(t.notice("notice:1")).resolves.toMatchObject({ ran: true });
  });
});
