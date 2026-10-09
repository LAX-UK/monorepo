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
});
