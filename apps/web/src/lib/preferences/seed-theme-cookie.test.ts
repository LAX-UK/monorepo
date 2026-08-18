import { seedDefaultThemeCookieIfNeeded } from "@/lib/preferences/seed-theme-cookie";
import { DEFAULT_THEME_PREFERENCE, THEME_COOKIE_NAME } from "@/lib/preferences/theme-cookie";
import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it } from "vitest";

describe("seedDefaultThemeCookieIfNeeded", () => {
  it("sets default theme when authed and theme cookie absent", () => {
    const req = new NextRequest("https://lax.bid/dashboard", {
      headers: { cookie: "lax-bid-session=abc" },
    });
    const res = NextResponse.next();

    seedDefaultThemeCookieIfNeeded(req, res);

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${THEME_COOKIE_NAME}=${DEFAULT_THEME_PREFERENCE}`);
  });

  it("does not overwrite existing theme cookie", () => {
    const req = new NextRequest("https://lax.bid/dashboard", {
      headers: { cookie: "lax-bid-session=abc; lax_theme=dark" },
    });
    const res = NextResponse.next();

    seedDefaultThemeCookieIfNeeded(req, res);

    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("skips when no auth session cookie", () => {
    const req = new NextRequest("https://lax.bid/dashboard");
    const res = NextResponse.next();

    seedDefaultThemeCookieIfNeeded(req, res);

    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
