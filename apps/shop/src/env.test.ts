import { describe, expect, it } from "vitest";
import { loadShopEnv } from "./env";

describe("loadShopEnv", () => {
  it("requires LAX_BID_PUBLIC_URL in production runtime", () => {
    expect(() => loadShopEnv({ NODE_ENV: "production", LAX_BID_PUBLIC_URL: undefined })).toThrow(
      /LAX_BID_PUBLIC_URL/,
    );
  });

  it("allows missing LAX_BID_PUBLIC_URL during Next production build", () => {
    expect(
      loadShopEnv({
        NODE_ENV: "production",
        NEXT_PHASE: "phase-production-build",
      }).LAX_BID_PUBLIC_URL,
    ).toBeUndefined();
  });
});
