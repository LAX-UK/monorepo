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
  SHOP_ADMIN_STEP_UP_RETRY_COOKIE,
} from "../../../../lib/session-cookie";
import { resolveStaffOAuthCallback } from "../../../../server/application/handle-staff-oauth-callback";
import { getShopAdminContainer } from "../../../../server/container";
import {
  classifyStaffLoginFailure,
  nextStepAfterStaffLoginFailure,
} from "../../../../server/domain/staff-login-failure";

function loginRedirect(publicOrigin: string, error: string): URL {
  return new URL(`/login?error=${encodeURIComponent(error)}`, publicOrigin);
}

function clearLoginAttemptCookies(cookieStore: Awaited<ReturnType<typeof cookies>>): void {
  cookieStore.delete(SHOP_ADMIN_LOGIN_COOKIE);
  cookieStore.delete(SHOP_ADMIN_LOGIN_RETRY_COOKIE);
  cookieStore.delete(SHOP_ADMIN_STEP_UP_RETRY_COOKIE);
}

export async function GET(request: Request): Promise<Response> {
  const container = getShopAdminContainer();
  const publicOrigin = container.config.publicOrigin;
  const secure = container.config.NODE_ENV === "production";
  const url = new URL(request.url);
  const cookieStore = await cookies();

  const outcome = resolveStaffOAuthCallback(
    {
      code: url.searchParams.get("code"),
      state: url.searchParams.get("state"),
      oauthError: url.searchParams.get("error"),
      errorDescription: url.searchParams.get("error_description"),
    },
    {
      pendingRaw: cookieStore.get(SHOP_ADMIN_LOGIN_COOKIE)?.value,
      hadLoginRetry: Boolean(cookieStore.get(SHOP_ADMIN_LOGIN_RETRY_COOKIE)?.value),
    },
  );

  if (outcome.kind === "login_error") {
    console.error("[shop-admin.oauth.callback]", outcome.log);
    clearLoginAttemptCookies(cookieStore);
    return NextResponse.redirect(loginRedirect(publicOrigin, outcome.reason));
  }

  if (outcome.kind === "missing_code") {
    return NextResponse.redirect(loginRedirect(publicOrigin, "missing_code"));
  }

  if (outcome.kind === "invalid_state") {
    clearLoginAttemptCookies(cookieStore);
    return NextResponse.redirect(loginRedirect(publicOrigin, "invalid_state"));
  }

  if (outcome.kind === "retry_login") {
    cookieStore.set(SHOP_ADMIN_LOGIN_RETRY_COOKIE, "1", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60,
    });
    return NextResponse.redirect(new URL("/api/auth/login?returnTo=/", publicOrigin));
  }

  if (outcome.kind === "missing_pending") {
    return NextResponse.redirect(loginRedirect(publicOrigin, "missing_pending"));
  }

  try {
    const result = await container.completeStaffLogin({
      config: container.config,
      pending: outcome.pending,
      receivedState: outcome.receivedState,
      code: outcome.code,
      sessions: container.sessions,
    });
    cookieStore.delete(SHOP_ADMIN_LOGIN_COOKIE);
    cookieStore.delete(SHOP_ADMIN_LOGIN_RETRY_COOKIE);
    cookieStore.delete(SHOP_ADMIN_STEP_UP_RETRY_COOKIE);
    cookieStore.set(SHOP_ADMIN_SESSION_COOKIE, result.sessionId, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: container.config.sessionTtlSeconds,
    });
    const csrf = randomBytes(24).toString("base64url");
    cookieStore.set(SHOP_ADMIN_CSRF_COOKIE, csrf, {
      httpOnly: false,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: container.config.sessionTtlSeconds,
    });
    cookieStore.set(SHOP_ADMIN_LOGIN_ATTEMPT_COOKIE, "1", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60,
    });
    const destination = safeReturnTo(result.returnTo);
    return NextResponse.redirect(new URL(destination, publicOrigin));
  } catch (error) {
    const code = classifyStaffLoginFailure(error);
    console.error("[shop-admin.oauth.callback] staff login failed", {
      code,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
    cookieStore.delete(SHOP_ADMIN_LOGIN_COOKIE);
    const next = nextStepAfterStaffLoginFailure(
      code,
      Boolean(cookieStore.get(SHOP_ADMIN_STEP_UP_RETRY_COOKIE)?.value),
    );
    if (next.kind === "restart_for_step_up") {
      cookieStore.set(SHOP_ADMIN_STEP_UP_RETRY_COOKIE, "1", {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      });
      const returnTo = safeReturnTo(outcome.pending.returnTo);
      return NextResponse.redirect(
        new URL(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`, publicOrigin),
      );
    }
    cookieStore.delete(SHOP_ADMIN_STEP_UP_RETRY_COOKIE);
    return NextResponse.redirect(loginRedirect(publicOrigin, next.reason));
  }
}
