import {
  DEFAULT_SILENT_SIGN_IN_MAX_AGES,
  createSilentSignInCookieSpec,
  defaultCookieSetOptions,
} from "@auction/identity-rp";
import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";

export const SHOP_SILENT_SSO_COOKIE_NAMES = createSilentSignInCookieSpec("shop_sso");

export function markShopSilentProbe(c: Context, secureCookies: boolean): void {
  setCookie(c, SHOP_SILENT_SSO_COOKIE_NAMES.probe, "1", {
    ...defaultCookieSetOptions(DEFAULT_SILENT_SIGN_IN_MAX_AGES.probeSeconds),
    secure: secureCookies,
  });
}

export function clearShopSilentProbe(c: Context): void {
  deleteCookie(c, SHOP_SILENT_SSO_COOKIE_NAMES.probe, { path: "/" });
}

export function markShopSilentQuiet(c: Context, secureCookies: boolean): void {
  deleteCookie(c, SHOP_SILENT_SSO_COOKIE_NAMES.probe, { path: "/" });
  setCookie(c, SHOP_SILENT_SSO_COOKIE_NAMES.quiet, "1", {
    ...defaultCookieSetOptions(DEFAULT_SILENT_SIGN_IN_MAX_AGES.quietSeconds),
    secure: secureCookies,
  });
}

export function markShopSilentSuppressed(c: Context, secureCookies: boolean): void {
  deleteCookie(c, SHOP_SILENT_SSO_COOKIE_NAMES.probe, { path: "/" });
  deleteCookie(c, SHOP_SILENT_SSO_COOKIE_NAMES.quiet, { path: "/" });
  setCookie(c, SHOP_SILENT_SSO_COOKIE_NAMES.suppressed, "1", {
    ...defaultCookieSetOptions(DEFAULT_SILENT_SIGN_IN_MAX_AGES.suppressedSeconds),
    secure: secureCookies,
  });
}

export function clearShopSilentSuppressed(c: Context): void {
  deleteCookie(c, SHOP_SILENT_SSO_COOKIE_NAMES.suppressed, { path: "/" });
}
