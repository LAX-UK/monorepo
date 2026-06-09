import { describe, expect, it } from "vitest";
import {
  buildMagicLinkExpiredCallbackUrl,
  buildMagicLinkSetPasswordCallbackUrl,
  isSafeMagicLinkNextPath,
} from "./magic-link-callback.js";

describe("magic-link-callback", () => {
  it("rejects unsafe next paths", () => {
    expect(isSafeMagicLinkNextPath("/login")).toBe(false);
    expect(isSafeMagicLinkNextPath("//evil.com")).toBe(false);
    expect(isSafeMagicLinkNextPath("https://evil.com")).toBe(false);
  });

  it("builds set-password callback with optional next", () => {
    expect(buildMagicLinkSetPasswordCallbackUrl("https://lax.bid/", "/dashboard")).toBe(
      "https://lax.bid/auth/activate/set-password?next=%2Fdashboard",
    );
    expect(buildMagicLinkSetPasswordCallbackUrl("https://lax.bid", "/login")).toBe(
      "https://lax.bid/auth/activate/set-password",
    );
  });

  it("builds expired callback", () => {
    expect(buildMagicLinkExpiredCallbackUrl("https://lax.bid/")).toBe(
      "https://lax.bid/auth/activate/expired",
    );
  });
});
