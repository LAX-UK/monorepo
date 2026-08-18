import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { STALE_AUTH_COOKIE_NAMES, purgeStaleAuthCookies } from "./purge-stale-auth-cookies";

describe("purgeStaleAuthCookies", () => {
  it("expires only host-bound Bid session cookies in production", () => {
    const res = NextResponse.next();
    purgeStaleAuthCookies(res, {
      nodeEnv: "production",
    });

    for (const name of STALE_AUTH_COOKIE_NAMES) {
      const header = res.cookies.get(name);
      expect(header).toBeDefined();
    }

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).not.toContain("Domain=");
    expect(setCookie).toContain("Secure");
  });
});
