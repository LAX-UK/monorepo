import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/env.server", () => ({
  loadArtEnv: () => ({
    LAX_BID_PUBLIC_URL: "https://lax.bid",
    LAX_SHOP_STOREFRONT_URL: "https://shop.lax.art",
    LAX_ART_PUBLIC_URL: "https://lax.art",
  }),
}));

import { loadArtFamilyLinks } from "./product-directory.server";

describe("loadArtFamilyLinks", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the same four links as the other products when the Account origin is not set", () => {
    vi.stubEnv("NEXT_PUBLIC_LAX_ACCOUNT_ORIGIN", "");
    vi.stubEnv("NODE_ENV", "production");
    const links = loadArtFamilyLinks();
    expect(links.map((link) => link.label)).toEqual([
      "lax.art",
      "lax.shop",
      "lax.bid",
      "LAX Account",
    ]);
    expect(links.at(-1)?.href).toBe("https://account.lax.bid/account");
    expect(links.find((link) => link.current)?.id).toBe("art");
  });

  it("links to the configured LAX Account origin", () => {
    vi.stubEnv("NEXT_PUBLIC_LAX_ACCOUNT_ORIGIN", "https://account.test.lax/");
    expect(loadArtFamilyLinks().at(-1)?.href).toBe("https://account.test.lax/account");
  });
});
