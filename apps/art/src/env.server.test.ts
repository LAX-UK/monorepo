import { describe, expect, it } from "vitest";
import { loadArtEnv } from "./env.server";

describe("loadArtEnv", () => {
  it("accepts lax.art storefront env", () => {
    const env = loadArtEnv({
      LAX_ART_PUBLIC_URL: "http://localhost:3050",
      ART_IDENTITY_BASE_URL: "http://localhost:3051",
      SHOP_API_BASE_URL: "http://localhost:3011",
    });
    expect(env.LAX_ART_PUBLIC_URL).toBe("http://localhost:3050");
  });

  it("accepts SEO and analytics settings and rejects a malformed GA4 id", () => {
    const env = loadArtEnv({
      ART_ALLOW_INDEXING: "false",
      ART_GA_MEASUREMENT_ID: " G-YGZCF5FD67 ",
      ART_GOOGLE_SITE_VERIFICATION: "token-123",
    });
    expect(env).toMatchObject({
      ART_ALLOW_INDEXING: "false",
      ART_GA_MEASUREMENT_ID: "G-YGZCF5FD67",
      ART_GOOGLE_SITE_VERIFICATION: "token-123",
    });
    expect(() => loadArtEnv({ ART_GA_MEASUREMENT_ID: "UA-1');alert(1)//" })).toThrow();
  });
});
