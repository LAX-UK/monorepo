import type { ArtListingFacts } from "@auction/artwork-register-contracts";
import type { RegisterListingSource } from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import { describe, expect, it, vi } from "vitest";
import { PRODUCT_ID, REGISTER_ID, factsFor, links } from "./listing-facts.fixture.js";
import type { ZohoListingState } from "./zoho-listing-fields.js";
import type { ListingUpdateResult, ZohoListingProducts } from "./zoho-listing-products.js";
import { ZohoListingSync, type ZohoListingSyncMode } from "./zoho-listing-sync.js";

const NOW = new Date("2026-11-05T12:00:00Z");
const EMPTY: ZohoListingState = { value: null, detail: null, link: null, updatedAt: null };

function source(id: string, productId: string): RegisterListingSource {
  const { laxArt: _ignored, ...rest } = factsFor("held");
  return { ...rest, entry: { ...rest.entry, id, zohoProductId: productId } };
}

function setup(
  options: {
    mode?: ZohoListingSyncMode;
    sources?: RegisterListingSource[];
    shown?: Map<string, ZohoListingState>;
    laxArt?: ArtListingFacts[];
    update?: (ids: string[]) => ListingUpdateResult[];
  } = {},
) {
  const sources = options.sources ?? [source(REGISTER_ID, PRODUCT_ID)];
  const shown = options.shown ?? new Map(sources.map((s) => [s.entry.zohoProductId, EMPTY]));
  const products: ZohoListingProducts = {
    read: vi.fn(async (ids: readonly string[]) => {
      const found = new Map<string, ZohoListingState>();
      for (const id of ids) {
        const state = shown.get(id);
        if (state) found.set(id, state);
      }
      return found;
    }),
    update: vi.fn(async (updates: readonly { productId: string }[]) =>
      options.update
        ? options.update(updates.map((u) => u.productId))
        : updates.map((u) => ({ productId: u.productId, ok: true as const })),
    ),
  };
  const read = vi.fn(async (ids: readonly string[]) =>
    sources.filter((s) => ids.includes(s.entry.id)),
  );
  const withLock = vi.fn(async (_ids: readonly string[], fn: () => Promise<unknown>) => fn());
  const log = { info: vi.fn(), warn: vi.fn() } as unknown as Logger;
  const sync = new ZohoListingSync({
    mode: options.mode ?? "live",
    sources: { read },
    laxArt: { find: vi.fn(async () => options.laxArt ?? []) },
    products,
    lock: { withLock: withLock as never },
    links,
    log,
    now: () => NOW,
  });
  return { sync, products, read, withLock, log };
}

describe("ZohoListingSync", () => {
  it("sends what differs, under the artworks' lock, after reading the facts", async () => {
    const { sync, products, withLock, read } = setup();
    const report = await sync.sync([REGISTER_ID]);

    expect(withLock).toHaveBeenCalledWith([REGISTER_ID], expect.any(Function));
    expect(read.mock.invocationCallOrder[0]).toBeGreaterThan(
      withLock.mock.invocationCallOrder[0] ?? 0,
    );
    expect(products.update).toHaveBeenCalledWith([
      {
        productId: PRODUCT_ID,
        fields: {
          LAX_Listing: "Not offered",
          LAX_Listing_Detail: null,
          LAX_Listing_Link: `https://admin.lax.art/from-zoho/${REGISTER_ID}`,
          LAX_Listing_Updated: "2026-11-05T12:00:00+00:00",
        },
      },
    ]);
    expect(report).toMatchObject({ checked: 1, changed: 1, unchanged: 0, failures: [] });
  });

  it("sends nothing the second time, once Zoho shows the listing", async () => {
    const shown = new Map([
      [
        PRODUCT_ID,
        {
          value: "Not offered",
          detail: null,
          link: `https://admin.lax.art/from-zoho/${REGISTER_ID}`,
          updatedAt: NOW,
        },
      ],
    ]);
    const { sync, products } = setup({ shown });
    expect(await sync.sync([REGISTER_ID])).toMatchObject({ changed: 0, unchanged: 1 });
    expect(products.update).not.toHaveBeenCalled();
  });

  it("batches 50 artworks per lock, read and request", async () => {
    const sources = Array.from({ length: 120 }, (_, i) =>
      source(`00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, `p${i}`),
    );
    const { sync, products, withLock } = setup({ sources });
    const report = await sync.sync(sources.map((s) => s.entry.id));
    expect(withLock).toHaveBeenCalledTimes(3);
    expect(vi.mocked(products.update).mock.calls.map(([u]) => u.length)).toEqual([50, 50, 20]);
    expect(report.changed).toBe(120);
  });

  it("reports what a dry run would send and sends nothing", async () => {
    const { sync, products, log } = setup({ mode: "dry_run" });
    expect(await sync.sync([REGISTER_ID])).toMatchObject({ changed: 1 });
    expect(products.update).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ zohoProductId: PRODUCT_ID }),
      "zoho_listing_dry_run",
    );
  });

  it("records a Product that no longer exists in Zoho, and a refused record, as failures", async () => {
    const sources = [
      source(REGISTER_ID, PRODUCT_ID),
      source("00000000-0000-4000-8000-000000000002", "gone"),
    ];
    const shown = new Map([[PRODUCT_ID, EMPTY]]);
    const { sync } = setup({
      sources,
      shown,
      update: (ids) =>
        ids.map((productId) => ({ productId, ok: false, code: "INVALID_DATA", retryable: false })),
    });
    const report = await sync.sync(sources.map((s) => s.entry.id));
    expect(report.failures.map((f) => [f.code, f.retryable])).toEqual([
      ["product_not_found", false],
      ["INVALID_DATA", false],
    ]);
    expect(report.changed).toBe(0);
  });

  it("leaves out records that are not originals", async () => {
    const { sync, products } = setup({ sources: [] });
    expect(await sync.sync([REGISTER_ID])).toMatchObject({ checked: 0 });
    expect(products.read).not.toHaveBeenCalled();
  });
});
