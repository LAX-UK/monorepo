import { describe, expect, it } from "vitest";
import { buildFullCatalogue } from "./demo-full-catalogue.js";
import { DEPARTMENTS } from "./demo-full-works.js";
import {
  DEMO_IMAGE_LONG_EDGE,
  DEMO_MEDIA_BASE_URL,
  DEMO_PORTRAIT_SOURCES,
  demoImageCatalogue,
  demoImageKey,
  demoImageUrl,
  demoPortraitUrl,
  departmentHeroSource,
} from "./demo-images.js";

const SOURCE = "https://images.metmuseum.org/CRDImages/ep/original/DP-20101-001.jpg";

describe("demo image keys", () => {
  it("is stable, readable and under the demo prefix", () => {
    expect(demoImageKey(SOURCE, "cover")).toBe(demoImageKey(SOURCE, "cover"));
    expect(demoImageKey(SOURCE, "cover")).toMatch(/^demo\/cover\/dp-20101-001-[0-9a-f]{8}\.jpg$/);
  });

  it("separates the copies a picture has for different uses", () => {
    expect(demoImageKey(SOURCE, "cover")).not.toBe(demoImageKey(SOURCE, "lot"));
  });

  it("separates different pictures that share a file name", () => {
    const other = "https://openaccess-cdn.clevelandart.org/1939.678/DP-20101-001.jpg";
    expect(demoImageKey(other, "lot")).not.toBe(demoImageKey(SOURCE, "lot"));
  });

  it("builds the public address on the media CDN", () => {
    expect(demoImageUrl(SOURCE, "lot")).toBe(
      `${DEMO_MEDIA_BASE_URL}/${demoImageKey(SOURCE, "lot")}`,
    );
  });
});

describe("demo image catalogue", () => {
  const catalogue = demoImageCatalogue();

  it("lists each copy once, with the size for how it is used", () => {
    expect(new Set(catalogue.map((e) => e.key)).size).toBe(catalogue.length);
    for (const e of catalogue) expect(e.longEdge).toBe(DEMO_IMAGE_LONG_EDGE[e.kind]);
    expect(DEMO_IMAGE_LONG_EDGE).toEqual({ cover: 2400, lot: 1600, portrait: 1200 });
  });

  it("records a licence and provider for every source", () => {
    for (const e of catalogue) {
      expect(e.licence).toMatch(/^CC0/);
      expect(e.provider.length).toBeGreaterThan(0);
    }
  });

  it("covers every picture the full catalogue points at, and nothing else is external", () => {
    const keys = new Set(catalogue.map((e) => `${DEMO_MEDIA_BASE_URL}/${e.key}`));
    const built = buildFullCatalogue(Date.UTC(2026, 10, 6, 9, 0), {
      collectorUserId: "c",
      collectorEntityId: "ce",
      rivalUserId: "r",
      rivalEntityId: "re",
      northbankBuyerUserId: "b",
      northbankId: "n",
      heldUserId: "h",
      heldEntityId: "he",
      laxStockId: "l",
    });
    for (const sale of built.sales) expect(keys.has(sale.coverImage)).toBe(true);
    for (const lot of built.lots) expect(keys.has(lot.image)).toBe(true);
    for (const department of DEPARTMENTS) {
      const source = departmentHeroSource(department.slug);
      expect(source).toBeDefined();
      expect(keys.has(demoImageUrl(source as string, "cover"))).toBe(true);
    }
  });
});

describe("demo portraits", () => {
  it("gives the first artists each a different picture", () => {
    const urls = DEMO_PORTRAIT_SOURCES.map((_, i) => demoPortraitUrl(i));
    expect(new Set(urls).size).toBe(DEMO_PORTRAIT_SOURCES.length);
    expect(DEMO_PORTRAIT_SOURCES.length).toBeGreaterThanOrEqual(16);
  });

  it("starts again only after the list is used up", () => {
    expect(demoPortraitUrl(DEMO_PORTRAIT_SOURCES.length)).toBe(demoPortraitUrl(0));
  });
});
