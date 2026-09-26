import { BID_SILENT_SSO_COOKIE_NAMES } from "@/lib/auth/silent-sign-in/cookies.server";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/bff/public-origin-url.server", () => ({
  resolvePublicOriginUrl: (path: string) => `https://lax.bid${path.startsWith("/") ? path : `/${path}`}`,
}));

const { redirectIfSilentProbeBlocked } = await import("./sso-probe-guard.server");

/** 43-char base64url session id (matches {@link generateSessionId}). */
const sessionId = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEfg";

describe("redirectIfSilentProbeBlocked", () => {
  it("redirects when a Bid session cookie is present", () => {
    const request = new NextRequest("https://lax.bid/api/auth/sso-probe?next=%2Fcatalog", {
      headers: { cookie: `lax-bid-session=${sessionId}` },
    });
    const response = redirectIfSilentProbeBlocked(request, "/catalog");
    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toContain("/catalog");
  });

  it("redirects when quiet cookie is set", () => {
    const request = new NextRequest("https://lax.bid/api/auth/sso-probe", {
      headers: { cookie: `${BID_SILENT_SSO_COOKIE_NAMES.quiet}=1` },
    });
    expect(redirectIfSilentProbeBlocked(request, "/dashboard")).not.toBeNull();
  });

  it("redirects when suppressed cookie is set", () => {
    const request = new NextRequest("https://lax.bid/api/auth/sso-probe", {
      headers: { cookie: `${BID_SILENT_SSO_COOKIE_NAMES.suppressed}=1` },
    });
    expect(redirectIfSilentProbeBlocked(request, "/dashboard")).not.toBeNull();
  });

  it("returns null when probe is allowed", () => {
    const request = new NextRequest("https://lax.bid/api/auth/sso-probe?next=%2Fcatalog");
    expect(redirectIfSilentProbeBlocked(request, "/catalog")).toBeNull();
  });
});
