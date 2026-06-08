import { describe, expect, it, vi } from "vitest";
import { buildMagicLinkVerifyUrl } from "./magic-link-verify-url";

vi.mock("@/lib/auth-client", () => ({
  getAuthIssuerBaseUrl: () => "https://auth.example.com",
}));

describe("buildMagicLinkVerifyUrl", () => {
  it("builds absolute verify URL with callback and error targets on web origin", () => {
    const url = new URL(buildMagicLinkVerifyUrl("tok123", "https://lax.bid"));
    expect(url.origin).toBe("https://auth.example.com");
    expect(url.pathname).toBe("/api/auth/magic-link/verify");
    expect(url.searchParams.get("token")).toBe("tok123");
    expect(url.searchParams.get("callbackURL")).toBe("https://lax.bid/auth/activate/set-password");
    expect(url.searchParams.get("errorCallbackURL")).toBe("https://lax.bid/auth/activate/expired");
  });
});
