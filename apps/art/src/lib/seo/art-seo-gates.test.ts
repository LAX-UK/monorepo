import { describe, expect, it } from "vitest";
import { isArtIndexingAllowedForHost, publicRequestHost } from "./art-indexing";
import { composeArtRobots } from "./art-robots";
import { buildLegacySitemapXml } from "./legacy-sitemap";

const SITE = new URL("https://www.thelax.art/");

describe("Art indexing gate", () => {
  it("indexes only the launch host unless overridden", () => {
    expect(isArtIndexingAllowedForHost("www.thelax.art", undefined)).toBe(true);
    expect(isArtIndexingAllowedForHost("WWW.THELAX.ART:443", undefined)).toBe(true);
    expect(isArtIndexingAllowedForHost("staging.lax.art", undefined)).toBe(false);
    expect(isArtIndexingAllowedForHost("art-abc.ondigitalocean.app", undefined)).toBe(false);
    expect(isArtIndexingAllowedForHost("staging.lax.art", "true")).toBe(true);
    expect(isArtIndexingAllowedForHost("www.thelax.art", "false")).toBe(false);
  });

  it("reads the public host from forwarded headers first", () => {
    const headers = new Headers({
      host: "10.0.0.1:3000",
      "x-forwarded-host": "www.thelax.art, cdn",
    });
    expect(publicRequestHost(headers)).toBe("www.thelax.art");
    expect(publicRequestHost(new Headers({ host: "localhost:3050" }))).toBe("localhost:3050");
  });
});

describe("Art robots", () => {
  it("blocks every crawler off production", () => {
    expect(composeArtRobots(SITE, false)).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("keeps private routes out and advertises both sitemaps in production", () => {
    const robots = composeArtRobots(SITE, true);
    expect(robots.rules).toMatchObject({
      allow: "/",
      disallow: expect.arrayContaining(["/account", "/preview", "/search", "/login", "/register"]),
    });
    expect(robots.sitemap).toEqual([
      "https://www.thelax.art/sitemap.xml",
      "https://www.thelax.art/legacy-sitemap.xml",
    ]);
    expect(robots.host).toBe("https://www.thelax.art");
  });
});

describe("legacy sitemap", () => {
  it("lists legacy page URLs on the live host and skips media", () => {
    const xml = buildLegacySitemapXml(
      {
        "/news/a&b.html": "/stories/a-b",
        "/faq": "/collector-hub/faq",
        "/uds/stock/1.jpg": "https://cdn.test/1.jpg",
      },
      SITE,
    );
    expect(xml).toContain("<loc>https://www.thelax.art/faq</loc>");
    expect(xml).toContain("<loc>https://www.thelax.art/news/a&amp;b.html</loc>");
    expect(xml).not.toContain("/uds/");
  });
});
