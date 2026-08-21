import {
  buildStaleSessionRecoveryLoginUrl,
  isLoginRecoveryLanding,
  isProtectedPostAuthPath,
  isStaleAuthEdgePublicLanding,
  resolveAuthEdgeRedirectTarget,
  shouldBypassAuthEdgeRedirect,
} from "@/lib/auth/auth-edge-policy";
import { describe, expect, it } from "vitest";

const SESSION_COOKIE = "better-auth.session_token=abc";

describe("isProtectedPostAuthPath", () => {
  it("recognizes dashboard and admin shells", () => {
    expect(isProtectedPostAuthPath("/dashboard")).toBe(true);
    expect(isProtectedPostAuthPath("/dashboard/bids")).toBe(true);
    expect(isProtectedPostAuthPath("/admin/finance")).toBe(true);
  });

  it("rejects marketing paths", () => {
    expect(isProtectedPostAuthPath("/")).toBe(false);
    expect(isProtectedPostAuthPath("/lot/foo/1")).toBe(false);
    expect(isProtectedPostAuthPath("/sales/bar")).toBe(false);
  });
});

describe("shouldBypassAuthEdgeRedirect", () => {
  it("bypasses recovery and explicit-intent query flags", () => {
    expect(shouldBypassAuthEdgeRedirect("/login", new URLSearchParams("session_expired=1"))).toBe(
      true,
    );
    expect(shouldBypassAuthEdgeRedirect("/login", new URLSearchParams("social_error=1"))).toBe(
      true,
    );
    expect(shouldBypassAuthEdgeRedirect("/login", new URLSearchParams("switch=1"))).toBe(true);
  });

  it("bypasses register with invite", () => {
    expect(shouldBypassAuthEdgeRedirect("/register", new URLSearchParams("invite=abc"))).toBe(true);
  });
});

describe("resolveAuthEdgeRedirectTarget", () => {
  it("routes protected next paths through the server decision", () => {
    const dest = resolveAuthEdgeRedirectTarget(
      new URL("http://localhost:3000/login?next=/dashboard/bids"),
    );
    expect(dest.pathname).toBe("/auth/post-login");
    expect(dest.searchParams.get("next")).toBe("/dashboard/bids");
    expect(dest.searchParams.get("welcome")).toBe("back");
  });

  it("routes public next through the server decision", () => {
    for (const next of ["/", "/lot/foo/1", "/sales/bar"]) {
      const dest = resolveAuthEdgeRedirectTarget(
        new URL(`http://localhost:3000/login?next=${encodeURIComponent(next)}`),
      );
      expect(dest.pathname).toBe("/auth/post-login");
      expect(dest.searchParams.get("next")).toBe(next);
      expect(dest.searchParams.get("welcome")).toBe("back");
    }
  });

  it("drops unsafe next before the server decision", () => {
    const dest = resolveAuthEdgeRedirectTarget(
      new URL("http://localhost:3000/login?next=//evil.com"),
    );
    expect(dest.pathname).toBe("/auth/post-login");
    expect(dest.searchParams.get("next")).toBeNull();
  });
});

describe("buildStaleSessionRecoveryLoginUrl", () => {
  it("strips edge markers and preserves safe return path", () => {
    const login = buildStaleSessionRecoveryLoginUrl(
      new URL("http://localhost:3000/?from=auth-edge&welcome=back"),
    );
    expect(login.pathname).toBe("/login");
    expect(login.searchParams.get("session_expired")).toBe("1");
    expect(login.searchParams.get("next")).toBe("/");
    expect(login.searchParams.get("from")).toBeNull();
  });

  it("preserves catalogue query params on lot pages", () => {
    const login = buildStaleSessionRecoveryLoginUrl(
      new URL("http://localhost:3000/lot/foo/1?view=grid&from=auth-edge&welcome=back"),
    );
    expect(login.searchParams.get("next")).toBe("/lot/foo/1?view=grid");
  });
});

describe("isStaleAuthEdgePublicLanding", () => {
  it("requires session cookie and from=auth-edge on public pages", () => {
    expect(
      isStaleAuthEdgePublicLanding(
        new URL("http://localhost:3000/?from=auth-edge&welcome=back"),
        SESSION_COOKIE,
      ),
    ).toBe(true);
    expect(
      isStaleAuthEdgePublicLanding(
        new URL("http://localhost:3000/?from=auth-edge&welcome=back"),
        "",
      ),
    ).toBe(false);
  });

  it("ignores protected dashboard edge landing", () => {
    expect(
      isStaleAuthEdgePublicLanding(
        new URL("http://localhost:3000/dashboard?from=auth-edge&welcome=back"),
        SESSION_COOKIE,
      ),
    ).toBe(false);
  });
});

describe("isLoginRecoveryLanding", () => {
  it("detects login recovery query flags", () => {
    expect(isLoginRecoveryLanding(new URL("http://localhost:3000/login?session_expired=1"))).toBe(
      true,
    );
    expect(isLoginRecoveryLanding(new URL("http://localhost:3000/login?social_error=1"))).toBe(
      true,
    );
    expect(isLoginRecoveryLanding(new URL("http://localhost:3000/login?auth=required"))).toBe(true);
    expect(isLoginRecoveryLanding(new URL("http://localhost:3000/login"))).toBe(false);
  });
});
