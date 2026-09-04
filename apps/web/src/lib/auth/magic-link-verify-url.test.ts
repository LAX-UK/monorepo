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
    expect(url.searchParams.get("callbackURL")).toBe(
      "https://lax.bid/api/auth/login?next=%2Fauth%2Factivate%2Fset-password%3Fauth_method%3Dmagic_link",
    );
    expect(url.searchParams.get("errorCallbackURL")).toBe("https://lax.bid/auth/activate/expired");
  });

  it("threads safe next into set-password callback", () => {
    const url = new URL(buildMagicLinkVerifyUrl("tok123", "https://lax.bid", "/dashboard"));
    expect(url.searchParams.get("callbackURL")).toBe(
      "https://lax.bid/api/auth/login?next=%2Fauth%2Factivate%2Fset-password%3Fnext%3D%252Fdashboard%26auth_method%3Dmagic_link",
    );
  });

  it("uses getSiteUrl when webOrigin is empty (SSR)", () => {
    vi.stubGlobal("window", undefined);
    vi.stubEnv("NEXT_PUBLIC_WEB_ORIGIN", "https://test.lax.bid");
    const url = new URL(buildMagicLinkVerifyUrl("tok123", ""));
    expect(url.searchParams.get("callbackURL")).toBe(
      "https://test.lax.bid/api/auth/login?next=%2Fauth%2Factivate%2Fset-password%3Fauth_method%3Dmagic_link",
    );
    expect(url.searchParams.get("errorCallbackURL")).toBe(
      "https://test.lax.bid/auth/activate/expired",
    );
    expect(url.searchParams.get("callbackURL")).not.toMatch(/^\//);
  });
});
