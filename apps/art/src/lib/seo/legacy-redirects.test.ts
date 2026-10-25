import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EDITORIAL_LEGAL_SLUGS, editorialPageHref } from "@/lib/editorial/editorial-page-routes";
import { LAX_ART_POLICIES, isLaxArtPolicySlug } from "@auction/marketing-ui";
import { describe, expect, it } from "vitest";
import { createLegacyRedirectResolver, legacyRedirects } from "./legacy-redirects";

const BASE = () => new URL("https://www.thelax.art/");

const resolve = createLegacyRedirectResolver({
  "/collection/flower.html": "/artworks/flower",
  "/glossary": "/collector-hub/glossary",
  "/prev-auction": "https://lax.bid/archive",
  "/uds/stock/1.jpg": "https://cdn.test/shop/artwork/thelax-abc.jpg",
});

function at(pathAndQuery: string) {
  return resolve(new URL(pathAndQuery, "https://www.thelax.art"), BASE);
}

describe("legacy redirect resolver", () => {
  it("sends legacy pages straight to the canonical www URL", () => {
    expect(at("/collection/flower.html")).toEqual({
      kind: "redirect",
      location: "https://www.thelax.art/artworks/flower",
    });
    expect(at("/Collection/Flower.html")?.kind).toBe("redirect");
    expect(at("/glossary/")).toEqual({
      kind: "redirect",
      location: "https://www.thelax.art/collector-hub/glossary",
    });
  });

  it("keeps campaign attribution and drops legacy CMS params", () => {
    expect(at("/glossary?word=impasto&utm_source=news&gclid=g1&page=2")).toEqual({
      kind: "redirect",
      location: "https://www.thelax.art/collector-hub/glossary?utm_source=news&gclid=g1",
    });
  });

  it("passes absolute targets through and maps thumbnails to the original image", () => {
    expect(at("/prev-auction")).toEqual({ kind: "redirect", location: "https://lax.bid/archive" });
    expect(at("/uds/stock/thumb/1.jpg")).toEqual({
      kind: "redirect",
      location: "https://cdn.test/shop/artwork/thelax-abc.jpg",
    });
    expect(at("/uds/stock/thumb1/1.jpg")?.kind).toBe("redirect");
  });

  it("reports unmapped legacy URLs and ignores new-site paths", () => {
    expect(at("/collection/gone.html")).toEqual({ kind: "miss", path: "/collection/gone.html" });
    expect(at("/uds/stock/9.jpg")).toEqual({ kind: "miss", path: "/uds/stock/9.jpg" });
    expect(at("/artworks/flower")).toBeNull();
    expect(at("/paintings")).toBeNull();
    expect(at("/")).toBeNull();
  });
});

describe("committed legacy redirect map", () => {
  const entries = Object.entries(legacyRedirects);
  const appDir = fileURLToPath(new URL("../../app", import.meta.url));
  const liveTopLevelRoutes = new Set(
    readdirSync(appDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("("))
      .map((entry) => `/${entry.name}`),
  );

  it("is one hop with no self-redirects", () => {
    for (const [from, to] of entries) {
      expect(to, from).not.toBe(from);
      expect(legacyRedirects[to], `${from} → ${to} chains`).toBeUndefined();
    }
  });

  it("never shadows a live Art route", () => {
    for (const [from] of entries) {
      expect(liveTopLevelRoutes.has(from), from).toBe(false);
    }
  });

  it("targets editorial pages on their canonical routes", () => {
    for (const [from, to] of entries) {
      const legal = /^\/legal\/([^/]+)$/.exec(to)?.[1];
      if (legal) {
        expect(EDITORIAL_LEGAL_SLUGS.has(legal) || isLaxArtPolicySlug(legal), from).toBe(true);
      }
      const page = /^\/collector-hub\/([^/]+)$/.exec(to)?.[1];
      if (page) expect(editorialPageHref(page), from).toBe(to);
    }
  });

  it("uses site-relative paths or https URLs only", () => {
    for (const [from, to] of entries) {
      expect(to.startsWith("/") || to.startsWith("https://"), from).toBe(true);
    }
  });

  it("sends every policy's address on the previous site to its lax.art page", () => {
    for (const policy of Object.values(LAX_ART_POLICIES)) {
      expect(legacyRedirects[policy.legacyPath], policy.legacyPath).toBe(policy.artPath);
    }
  });
});
