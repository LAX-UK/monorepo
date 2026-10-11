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
});
