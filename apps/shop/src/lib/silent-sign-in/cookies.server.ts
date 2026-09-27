import "server-only";

import {
  DEFAULT_SILENT_SIGN_IN_MAX_AGES,
  createSilentSignInCookieSpec,
} from "@auction/identity-rp/silent-sign-in";
import { cookies } from "next/headers";
import { SHOP_SILENT_SSO_COOKIE_PREFIX } from "./config";

const SHOP_SILENT_SSO_COOKIE_NAMES = createSilentSignInCookieSpec(SHOP_SILENT_SSO_COOKIE_PREFIX);

function secureCookies(): boolean {
  return process.env.NODE_ENV === "production" || process.env.ALLOW_HTTP_COOKIES !== "true";
}

export async function markShopSilentNoticeOnStorefront(): Promise<void> {
  const jar = await cookies();
  jar.set(SHOP_SILENT_SSO_COOKIE_NAMES.notice, "1", {
    path: "/",
    maxAge: DEFAULT_SILENT_SIGN_IN_MAX_AGES.noticeSeconds,
    sameSite: "lax",
    secure: secureCookies(),
    httpOnly: false,
  });
}

export const SHOP_SILENT_NOTICE_COOKIE = SHOP_SILENT_SSO_COOKIE_NAMES.notice;
