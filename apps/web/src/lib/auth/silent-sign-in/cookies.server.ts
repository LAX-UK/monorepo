import "server-only";

import {
  DEFAULT_SILENT_SIGN_IN_MAX_AGES,
  createSilentSignInCookieSpec,
  defaultCookieSetOptions,
} from "@auction/identity-rp";
import type { NextResponse } from "next/server";
import { BID_SILENT_SSO_COOKIE_PREFIX } from "./config";

export const BID_SILENT_GUEST_RESULT_COOKIE = "bid_sso_result";

export const BID_SILENT_SSO_COOKIE_NAMES = createSilentSignInCookieSpec(
  BID_SILENT_SSO_COOKIE_PREFIX,
);

function secureCookies(): boolean {
  return process.env.NODE_ENV === "production";
}

function applyCookieOptions(maxAgeSeconds: number) {
  const base = defaultCookieSetOptions(maxAgeSeconds);
  return {
    httpOnly: base.httpOnly,
    sameSite: "lax" as const,
    path: base.path,
    maxAge: base.maxAgeSeconds,
    secure: secureCookies(),
  };
}

export function markBidSilentQuiet(response: NextResponse): void {
  response.cookies.set(
    BID_SILENT_SSO_COOKIE_NAMES.quiet,
    "1",
    applyCookieOptions(DEFAULT_SILENT_SIGN_IN_MAX_AGES.quietSeconds),
  );
  response.cookies.delete(BID_SILENT_SSO_COOKIE_NAMES.probe);
}

export function markBidSilentSuppressed(response: NextResponse): void {
  response.cookies.set(
    BID_SILENT_SSO_COOKIE_NAMES.suppressed,
    "1",
    applyCookieOptions(DEFAULT_SILENT_SIGN_IN_MAX_AGES.suppressedSeconds),
  );
  response.cookies.delete(BID_SILENT_SSO_COOKIE_NAMES.quiet);
  response.cookies.delete(BID_SILENT_SSO_COOKIE_NAMES.probe);
}

export function clearBidSilentSuppressed(response: NextResponse): void {
  response.cookies.delete(BID_SILENT_SSO_COOKIE_NAMES.suppressed);
}

export function markBidSilentGuestResult(response: NextResponse): void {
  response.cookies.set(BID_SILENT_GUEST_RESULT_COOKIE, "guest", {
    path: "/",
    maxAge: 60,
    sameSite: "lax",
    secure: secureCookies(),
    httpOnly: false,
  });
}
