import type { RegisterLocationSource } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { ZohoLocationSync } from "./zoho-location-sync.js";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

function source(registerId: string, product: string, name: string | null): RegisterLocationSource {
  return {
    registerId,
    stockCode: `LAX-ORI-PH-GAC-26-${product}`,
    zohoProductId: product,
    location: name ? { id: `loc-${name}`, name, status: "active" } : null,
  };
}

function setup(input: {
  mode?: "dry_run" | "live";
  sources: RegisterLocationSource[];
  shown: Record<string, string | null>;
  update?: (
    updates: { productId: string }[],
  ) => { productId: string; ok: boolean; code?: string; retryable?: boolean }[];
}) {
  const products = {
    read: vi.fn(async () => new Map(Object.entries(input.shown))),
    update: vi.fn(async (updates: { productId: string }[]) =>
      input.update
        ? input.update(updates)
        : updates.map((update) => ({ productId: update.productId, ok: true })),
    ),
  };
  const lock = { withLock: vi.fn(async (_ids: readonly string[], fn: () => unknown) => fn()) };
  const log = { info: vi.fn(), warn: vi.fn() };
  const sync = new ZohoLocationSync({
    mode: input.mode ?? "live",
    sources: { read: vi.fn(async () => input.sources) },
    products: products as never,
    lock: lock as never,
    log: log as never,
  });
  return { sync, products, lock, log };
}

describe("ZohoLocationSync", () => {
  it("sends only the Products whose LAX_Location differs, under the artworks' lock", async () => {
    const { sync, products, lock } = setup({
      sources: [source(ID_A, "1", "Framer"), source(ID_B, "2", "Store room")],
      shown: { "1": "Store room", "2": "Store room" },
    });
    const report = await sync.sync([ID_A, ID_B, ID_A]);
    expect(lock.withLock).toHaveBeenCalledWith([ID_A, ID_B], expect.any(Function));
    expect(products.update).toHaveBeenCalledWith([
      { productId: "1", fields: { LAX_Location: "Framer" } },
    ]);
    expect(report).toMatchObject({ checked: 2, changed: 1, unchanged: 1, failures: [] });
  });

  it("sends nothing when Zoho already shows the value, so a repeat writes once", async () => {
    const { sync, products } = setup({
      sources: [source(ID_A, "1", "Framer"), source(ID_B, "2", null)],
      shown: { "1": "Framer", "2": null },
    });
    const report = await sync.sync([ID_A, ID_B]);
    expect(products.update).not.toHaveBeenCalled();
    expect(report).toMatchObject({ checked: 2, changed: 0, unchanged: 2 });
  });

  it("sends nothing again for a name with stray spaces Zoho already shows trimmed", async () => {
    const { sync, products } = setup({
      sources: [source(ID_A, "1", " Store  room ")],
      shown: { "1": "Store room" },
    });
    const report = await sync.sync([ID_A]);
    expect(products.update).not.toHaveBeenCalled();
    expect(report).toMatchObject({ checked: 1, changed: 0, unchanged: 1 });
  });

  it("clears a value edited into Zoho for an artwork with no location recorded", async () => {
    const { sync, products } = setup({
      sources: [source(ID_A, "1", null)],
      shown: { "1": "Typed in Zoho" },
    });
    await sync.sync([ID_A]);
    expect(products.update).toHaveBeenCalledWith([
      { productId: "1", fields: { LAX_Location: null } },
    ]);
  });

  it("in a dry run reads both sides, logs what it would send and sends nothing", async () => {
    const { sync, products, log } = setup({
      mode: "dry_run",
      sources: [source(ID_A, "1", "Framer")],
      shown: { "1": null },
    });
    const report = await sync.sync([ID_A]);
    expect(products.read).toHaveBeenCalled();
    expect(products.update).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ zohoProductId: "1", fields: { LAX_Location: "Framer" } }),
      "zoho_location_dry_run",
    );
    expect(report.changed).toBe(1);
  });

  it("reports a Product gone from Zoho and a refused write as failures", async () => {
    const { sync } = setup({
      sources: [source(ID_A, "1", "Framer"), source(ID_B, "2", "Framer")],
      shown: { "2": null },
      update: (updates) =>
        updates.map((update) => ({
          productId: update.productId,
          ok: false,
          code: "TOO_MANY_REQUESTS",
          retryable: true,
        })),
    });
    const report = await sync.sync([ID_A, ID_B]);
    expect(report.failures).toEqual([
      {
        registerId: ID_A,
        stockCode: "LAX-ORI-PH-GAC-26-1",
        code: "product_not_found",
        retryable: false,
      },
      {
        registerId: ID_B,
        stockCode: "LAX-ORI-PH-GAC-26-2",
        code: "TOO_MANY_REQUESTS",
        retryable: true,
      },
    ]);
  });

  it("does not call Zoho when none of the records is an original", async () => {
    const { sync, products } = setup({ sources: [], shown: {} });
    expect(await sync.sync([ID_A])).toMatchObject({ checked: 0, changed: 0 });
    expect(products.read).not.toHaveBeenCalled();
  });
});
