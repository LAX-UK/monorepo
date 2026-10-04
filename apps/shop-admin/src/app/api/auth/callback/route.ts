import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SHOP_ADMIN_CSRF_COOKIE,
  SHOP_ADMIN_LOGIN_COOKIE,
  SHOP_ADMIN_SESSION_COOKIE,
} from "../../../../lib/session-cookie";
import type { PendingStaffLogin } from "../../../../server/application/start-staff-login";
import { getShopAdminContainer } from "../../../../server/container";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }
  const cookieStore = await cookies();
  const pendingRaw = cookieStore.get(SHOP_ADMIN_LOGIN_COOKIE)?.value;
  if (!pendingRaw) {
    return NextResponse.redirect(new URL("/login?error=missing_pending", request.url));
  }
  const pending = JSON.parse(pendingRaw) as PendingStaffLogin;
  const container = getShopAdminContainer();
  try {
    const result = await container.completeStaffLogin({
      config: container.config,
      pending,
      receivedState: state,
      code,
      sessions: container.sessions,
    });
    cookieStore.delete(SHOP_ADMIN_LOGIN_COOKIE);
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
    return NextResponse.redirect(new URL(result.returnTo, container.config.publicOrigin));
  } catch {
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
  }
}
