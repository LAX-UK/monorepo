import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LAX_FAVICON_ASSET_NAMES,
  LAX_HOSTED_AUTH_FAVICON_BASE_PATH,
  laxFaviconContentType,
  laxFaviconLinkTags,
  laxFaviconMetadataIcons,
} from "../src/favicons.js";

describe("LAX favicons", () => {
  it("builds Next-compatible icon metadata under /favicons", () => {
    const icons = laxFaviconMetadataIcons();
    expect(icons.apple).toBe("/favicons/apple-touch-icon.png");
    expect(icons.icon.some((entry) => entry.url.endsWith("favicon-32x32.png"))).toBe(true);
  });

  it("renders hosted auth link tags without external URLs", () => {
    const html = laxFaviconLinkTags();
    expect(html).toContain(`href="${LAX_HOSTED_AUTH_FAVICON_BASE_PATH}/favicon-32x32.png"`);
    expect(html).not.toContain("thelax.art");
  });

  it("maps content types for vendored asset names", () => {
    expect(laxFaviconContentType("favicon.ico")).toBe("image/x-icon");
    expect(laxFaviconContentType("favicon-16x16.png")).toBe("image/png");
    expect(LAX_FAVICON_ASSET_NAMES.length).toBeGreaterThan(0);
  });

  it("ships a favicon.ico built from the same LAX mark as the PNG set", () => {
    const asset = (name: string) =>
      readFileSync(fileURLToPath(new URL(`../public/favicons/${name}`, import.meta.url)));
    const ico = asset("favicon.ico");
    expect(ico.subarray(0, 4)).toEqual(Buffer.from([0, 0, 1, 0]));
    for (const png of ["favicon-16x16.png", "favicon-32x32.png"]) {
      expect(ico.includes(asset(png))).toBe(true);
    }
  });
});
