import {
  buildRequestWithAuthEdgeHeader,
  getAuthPublicCookieRedirectUrl,
} from "@/lib/auth/auth-public-edge";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

describe("getAuthPublicCookieRedirectUrl", () => {
  it("returns null for forgot-password (not matched)", () => {
    const u = new URL("http://localhost:3000/forgot-password");
    expect(getAuthPublicCookieRedirectUrl(u, "better-auth.session=1")).toBeNull();
  });

  it("bypasses when switch=1", () => {
    const u = new URL("http://localhost:3000/login?switch=1");
    expect(getAuthPublicCookieRedirectUrl(u, "better-auth.session=1")).toBeNull();
  });

  it("bypasses when session_expired=1 (avoid stale-cookie loop)", () => {
    const u = new URL("http://localhost:3000/login?session_expired=1");
    expect(getAuthPublicCookieRedirectUrl(u, "better-auth.session=1")).toBeNull();
  });

  it("bypasses when auth=required (avoid stale-cookie loop)", () => {
    const u = new URL("http://localhost:3000/login?auth=required&next=/dashboard");
    expect(getAuthPublicCookieRedirectUrl(u, "better-auth.session=1")).toBeNull();
  });

  it("bypasses when registered=1 (post-signup landing)", () => {
    const u = new URL("http://localhost:3000/login?registered=1");
    expect(getAuthPublicCookieRedirectUrl(u, "better-auth.session=1")).toBeNull();
  });

  it("bypasses when reset=1 (post-reset landing)", () => {
    const u = new URL("http://localhost:3000/login?reset=1");
    expect(getAuthPublicCookieRedirectUrl(u, "better-auth.session=1")).toBeNull();
  });

  it("bypasses register with invite", () => {
    const u = new URL("http://localhost:3000/register?invite=abc");
    expect(getAuthPublicCookieRedirectUrl(u, "session_token=x")).toBeNull();
  });

  it("bypasses when verify_pending=1", () => {
    const u = new URL("http://localhost:3000/login?verify_pending=1");
    expect(getAuthPublicCookieRedirectUrl(u, "better-auth.session=1")).toBeNull();
  });

  it("routes cookie login through the server decision with safe next", () => {
    const u = new URL("http://localhost:3000/login?next=/dashboard/bids");
    const out = getAuthPublicCookieRedirectUrl(u, "better-auth.session=1");
    expect(out?.pathname).toBe("/auth/post-login");
    expect(out?.searchParams.get("next")).toBe("/dashboard/bids");
    expect(out?.searchParams.get("welcome")).toBe("back");
  });

  it("drops an unsafe next before the server decision", () => {
    const u = new URL("http://localhost:3000/login?next=//evil.com");
    const out = getAuthPublicCookieRedirectUrl(u, "session_token=x");
    expect(out?.pathname).toBe("/auth/post-login");
    expect(out?.searchParams.get("next")).toBeNull();
  });
});

describe("buildRequestWithAuthEdgeHeader", () => {
  it("tags dashboard requests with from=auth-edge", () => {
    const req = new NextRequest(new URL("http://localhost:3000/dashboard?from=auth-edge"));
    const out = buildRequestWithAuthEdgeHeader(req);
    expect(out?.request.headers.get("x-lax-auth-edge")).toBe("1");
  });

  it("returns null without from=auth-edge", () => {
    const req = new NextRequest(new URL("http://localhost:3000/dashboard"));
    expect(buildRequestWithAuthEdgeHeader(req)).toBeNull();
  });
});
