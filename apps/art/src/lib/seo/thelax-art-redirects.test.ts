import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  type RetiredArtRouteDestinations,
  followRetiredArtRoute,
  resolveRetiredArtRoute,
} from "@/lib/routing/retired-art-routes";
import { describe, expect, it } from "vitest";
import { isArtIndexingAllowedForHost } from "./art-indexing";
import { legacyRedirects, resolveLegacyRedirect } from "./legacy-redirects";
import {
  THELAX_ART_HOSTS,
  createThelaxArtHostRedirect,
  resolveThelaxArtHostRedirect,
  thelaxArtRedirectRows,
} from "./thelax-art-redirects";
import thelaxArtRedirectsFile from "./thelax-art-redirects.json";

const LAX_ART = new URL("https://lax.art/");
const DESTINATIONS: RetiredArtRouteDestinations = {
  laxAccountUrl: (destination) => `https://account.lax.test/${destination}`,
  shopBaseUrl: new URL("https://shop.lax.art/"),
};

/** What the middleware answers for a thelax.art request: the host move, retired pages followed. */
function finalLocation(pathAndQuery: string, host = "www.thelax.art"): string | null {
  const url = new URL(pathAndQuery, `https://${host}`);
  const moved = resolveThelaxArtHostRedirect(url, host, LAX_ART);
  return moved ? followRetiredArtRoute(moved, LAX_ART, DESTINATIONS) : null;
}

describe("thelax.art host move", () => {
  const resolve = createThelaxArtHostRedirect(
    [
      {
        from: "/about-us",
        to: "/collector-hub/about-us",
        type: "page",
        title: null,
        match: "exact",
      },
      {
        from: "/prev-auction",
        to: "https://lax.bid/archive",
        type: "page",
        title: null,
        match: "best-match",
      },
    ],
    (url, base) =>
      url.pathname === "/uds/stock/1.jpg"
        ? { kind: "redirect", location: new URL("/media/1.jpg", base()).toString() }
        : null,
  );
  const at = (pathAndQuery: string, host = "thelax.art", base = LAX_ART) =>
    resolve(new URL(pathAndQuery, `https://${host}`), host, base);

  it("applies to thelax.art and www.thelax.art only", () => {
    expect(at("/about-us", "thelax.art")).toBe("https://lax.art/collector-hub/about-us");
    expect(at("/about-us", "www.thelax.art")).toBe("https://lax.art/collector-hub/about-us");
    expect(at("/about-us", "WWW.TheLax.Art:443")).toBe("https://lax.art/collector-hub/about-us");
    expect(at("/about-us", "lax.art")).toBeNull();
    expect(at("/about-us", "test.thelax.art")).toBeNull();
    expect(at("/about-us", "art-abc.ondigitalocean.app")).toBeNull();
  });

  it("stays off while the app's own public URL is still a thelax.art host", () => {
    expect(at("/about-us", "www.thelax.art", new URL("https://www.thelax.art/"))).toBeNull();
    expect(at("/about-us", "thelax.art", new URL("https://thelax.art/"))).toBeNull();
  });

  it("maps listed URLs, keeps campaign parameters and tolerates case and trailing slashes", () => {
    expect(at("/About-Us/?utm_source=news&page=2&gclid=g")).toBe(
      "https://lax.art/collector-hub/about-us?utm_source=news&gclid=g",
    );
    expect(at("/prev-auction")).toBe("https://lax.bid/archive");
  });

  it("uses the legacy media map, then keeps the path for anything unlisted", () => {
    expect(at("/uds/stock/1.jpg")).toBe("https://lax.art/media/1.jpg");
    expect(at("/artworks/flower?view=room")).toBe("https://lax.art/artworks/flower?view=room");
    expect(at("/")).toBe("https://lax.art/");
  });
});

describe("thelax.art redirect data file", () => {
  const rows = thelaxArtRedirectRows;
  const appDir = fileURLToPath(new URL("../../app", import.meta.url));
  const liveTopLevelRoutes = new Set(
    readdirSync(appDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("("))
      .map((entry) => `/${entry.name}`),
  );
  const sectionRoutes = new Set([
    "/",
    "/artworks",
    "/artists",
    "/stories",
    "/collector-hub",
    "/exhibitions",
    "/art-hub",
  ]);

  it("has one valid row per old URL", () => {
    const seen = new Set<string>();
    for (const row of rows) {
      expect(seen.has(row.from), `duplicate ${row.from}`).toBe(false);
      seen.add(row.from);
      expect(row.from.startsWith("/"), row.from).toBe(true);
      expect(row.from === "/" || !row.from.split("?")[0]?.endsWith("/"), row.from).toBe(true);
      expect(row.to.startsWith("/") || row.to.startsWith("https://"), row.from).toBe(true);
      expect(["artwork", "artist", "page", "post", "category"]).toContain(row.type);
      expect(["exact", "best-match", "no-equivalent"]).toContain(row.match);
      expect(row.title === null || row.title.trim().length > 0, row.from).toBe(true);
    }
  });

  it("states the counts it holds", () => {
    const counts = { total: rows.length, exact: 0, "best-match": 0, "no-equivalent": 0 };
    for (const row of rows) counts[row.match] += 1;
    expect(thelaxArtRedirectsFile.counts).toEqual(counts);
  });

  it("sends no-equivalent URLs to a section page and the home page only as a last resort", () => {
    for (const row of rows) {
      if (row.match === "no-equivalent") expect(sectionRoutes.has(row.to), row.from).toBe(true);
      if (row.to === "/" && row.from !== "/") {
        expect(row.match, `${row.from} lands on the home page`).toBe("no-equivalent");
      }
    }
    const toHome = rows.filter((row) => row.to === "/" && row.from !== "/").map((row) => row.from);
    expect(toHome).toEqual(["/site-map"]);
  });

  it("targets live lax.art routes", () => {
    for (const row of rows) {
      if (row.to.startsWith("https://")) continue;
      const top = `/${row.to.split("/")[1] ?? ""}`;
      expect(
        row.to === "/" ||
          liveTopLevelRoutes.has(top) ||
          resolveRetiredArtRoute(row.to, DESTINATIONS) !== null,
        `${row.from} → ${row.to}`,
      ).toBe(true);
    }
  });

  it("resolves every row in one hop, with no chains or loops", () => {
    for (const row of rows) {
      for (const host of THELAX_ART_HOSTS) {
        const location = finalLocation(row.from, host);
        expect(location, `${host}${row.from}`).not.toBeNull();
        const target = new URL(location as string);
        expect(THELAX_ART_HOSTS.has(target.hostname), `${row.from} loops back`).toBe(false);
        if (target.origin !== LAX_ART.origin) continue;
        // The destination is final: no rule on lax.art redirects it again.
        expect(
          resolveRetiredArtRoute(target.pathname, DESTINATIONS),
          `${row.from} chains`,
        ).toBeNull();
        expect(
          resolveLegacyRedirect(target, () => LAX_ART),
          `${row.from} chains`,
        ).toBeNull();
        expect(resolveThelaxArtHostRedirect(target, target.host, LAX_ART)).toBeNull();
      }
    }
  });

  it("agrees with the legacy redirect map", () => {
    for (const row of rows) {
      const path = row.from.split("?")[0] as string;
      if (legacyRedirects[path]) expect(row.to, row.from).toBe(legacyRedirects[path]);
    }
  });

  it("covers every URL in the legacy inventory", () => {
    const inventoryPath = fileURLToPath(
      new URL("../../../../../docs/seo/legacy-thelax-inventory.json", import.meta.url),
    );
    const inventory = JSON.parse(readFileSync(inventoryPath, "utf8")) as {
      entries: { path: string }[];
    };
    const froms = new Set(rows.map((row) => row.from));
    const missing = inventory.entries.map((entry) => entry.path).filter((path) => !froms.has(path));
    expect(missing).toEqual([]);
  });

  it("makes the destination host indexable", () => {
    expect(isArtIndexingAllowedForHost(LAX_ART.hostname, undefined)).toBe(true);
  });
});
