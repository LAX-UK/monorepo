import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPortalFetchers } from "./create-portal-fetchers.js";

describe("resolveShopPortalOwnershipEnabled", () => {
  const originalEnv = process.env.SHOP_PORTAL_OWNERSHIP_ENABLED;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalEnv === undefined) {
      process.env.SHOP_PORTAL_OWNERSHIP_ENABLED = undefined;
    } else {
      process.env.SHOP_PORTAL_OWNERSHIP_ENABLED = originalEnv;
    }
  });

  function createResolver() {
    return createPortalFetchers({
      commerceRequest: vi.fn(),
      shopApiServerUrl: (path: string) => `http://shop-api.test${path}`,
      readOwnershipEnvFlag: () => process.env.SHOP_PORTAL_OWNERSHIP_ENABLED?.trim(),
    }).resolveShopPortalOwnershipEnabled;
  }

  it("returns true when storefront env is true without probing", async () => {
    process.env.SHOP_PORTAL_OWNERSHIP_ENABLED = "true";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(createResolver()()).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false when storefront env is false without probing", async () => {
    process.env.SHOP_PORTAL_OWNERSHIP_ENABLED = "false";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(createResolver()()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("probes shop-api and treats 401 as enabled", async () => {
    process.env.SHOP_PORTAL_OWNERSHIP_ENABLED = undefined;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    await expect(createResolver()()).resolves.toBe(true);
  });

  it("probes shop-api and treats feature_disabled as disabled", async () => {
    process.env.SHOP_PORTAL_OWNERSHIP_ENABLED = undefined;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ code: SHOP_API_ERROR_CODES.FEATURE_DISABLED }, { status: 404 }),
        ),
    );

    await expect(createResolver()()).resolves.toBe(false);
  });
});
