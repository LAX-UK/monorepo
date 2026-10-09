import { randomBytes } from "node:crypto";
import { safeReturnTo } from "@/lib/safe-return-to";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SHOP_ADMIN_CSRF_COOKIE,
  SHOP_ADMIN_LOGIN_ATTEMPT_COOKIE,
  SHOP_ADMIN_LOGIN_COOKIE,
  SHOP_ADMIN_LOGIN_RETRY_COOKIE,
  SHOP_ADMIN_SESSION_COOKIE,
} from "../../../../lib/session-cookie";
import type { PendingStaffLogin } from "../../../../server/application/start-staff-login";
import { getShopAdminContainer } from "../../../../server/container";

function loginRedirect(publicOrigin: string, error: string): URL {
  return new URL(`/login?error=${encodeURIComponent(error)}`, publicOrigin);
}

export async function GET(request: Request): Promise<Response> {
  const container = getShopAdminContainer();
  const publicOrigin = container.config.publicOrigin;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(loginRedirect(publicOrigin, "missing_code"));
  }
  const cookieStore = await cookies();
  const pendingRaw = cookieStore.get(SHOP_ADMIN_LOGIN_COOKIE)?.value;
  if (!pendingRaw) {
    const hadRetry = Boolean(cookieStore.get(SHOP_ADMIN_LOGIN_RETRY_COOKIE)?.value);
    if (!hadRetry) {
      cookieStore.set(SHOP_ADMIN_LOGIN_RETRY_COOKIE, "1", {
        httpOnly: true,
        secure: container.config.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60,
      });
      return NextResponse.redirect(new URL("/api/auth/login?returnTo=/", publicOrigin));
    }
    return NextResponse.redirect(loginRedirect(publicOrigin, "missing_pending"));
  }
  try {
    const pending = JSON.parse(pendingRaw) as PendingStaffLogin;
    const result = await container.completeStaffLogin({
      config: container.config,
      pending,
      receivedState: state,
      code,
      sessions: container.sessions,
    });
    cookieStore.delete(SHOP_ADMIN_LOGIN_COOKIE);
    cookieStore.delete(SHOP_ADMIN_LOGIN_RETRY_COOKIE);
    cookieStore.set(SHOP_ADMIN_SESSION_COOKIE, result.sessionId, {
      httpOnly: true,
      secure: container.config.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: container.config.sessionTtlSeconds,
    });
    const csrf = randomBytes(24).toString("base64url");
    cookieStore.set(SHOP_ADMIN_CSRF_COOKIE, csrf, {
      httpOnly: false,
      secure: container.config.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: container.config.sessionTtlSeconds,
    });
    cookieStore.set(SHOP_ADMIN_LOGIN_ATTEMPT_COOKIE, "1", {
      httpOnly: true,
      secure: container.config.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60,
    });
    const destination = safeReturnTo(result.returnTo);
    return NextResponse.redirect(new URL(destination, publicOrigin));
  } catch {
    cookieStore.delete(SHOP_ADMIN_LOGIN_COOKIE);
    return NextResponse.redirect(loginRedirect(publicOrigin, "auth_failed"));
  }
}
