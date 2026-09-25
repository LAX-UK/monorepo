import "server-only";

import type { NextRequest, NextResponse } from "next/server";
import { bidSessionCookieUsesSecureTransport } from "./session-cookie.server";

export const BID_ONBOARDING_INVITE_COOKIE = "bid_onboarding_invite";
const MAX_AGE_SECONDS = 30 * 60;

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

function parseInviteCookieValue(raw: string | undefined): string | null {
  if (!raw || raw.length < 16 || raw.length > 512) return null;
  return raw;
}

export function readOnboardingInviteToken(request: NextRequest): string | null {
  return parseInviteCookieValue(request.cookies.get(BID_ONBOARDING_INVITE_COOKIE)?.value);
}

export function readOnboardingInviteTokenFromStore(store: CookieReader): string | null {
  return parseInviteCookieValue(store.get(BID_ONBOARDING_INVITE_COOKIE)?.value);
}

export function setOnboardingInviteCookie(response: NextResponse, token: string): void {
  response.cookies.set(BID_ONBOARDING_INVITE_COOKIE, token, {
    httpOnly: true,
    secure: bidSessionCookieUsesSecureTransport(),
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearOnboardingInviteCookie(response: NextResponse): void {
  response.cookies.set(BID_ONBOARDING_INVITE_COOKIE, "", {
    httpOnly: true,
    secure: bidSessionCookieUsesSecureTransport(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
