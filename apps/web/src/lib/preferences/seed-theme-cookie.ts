import { hasAuthSessionCookie } from "@/lib/auth/session-cookie";
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_COOKIE_MAX_AGE_SEC,
  THEME_COOKIE_NAME,
} from "@/lib/preferences/theme-cookie";
import type { NextRequest, NextResponse } from "next/server";

/** Seed `lax_theme` on the response when authed and the browser has no theme cookie yet. */
export function seedDefaultThemeCookieIfNeeded(request: NextRequest, response: NextResponse): void {
  const cookieHeader = request.headers.get("cookie") ?? "";
  if (!hasAuthSessionCookie(cookieHeader)) return;
  if (request.cookies.get(THEME_COOKIE_NAME)?.value) return;

  response.cookies.set(THEME_COOKIE_NAME, DEFAULT_THEME_PREFERENCE, {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE_SEC,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
