import { safeReturnTo } from "@/lib/safe-return-to";
import { LAX_ACCOUNT_LOGIN_COOKIE, LAX_ACCOUNT_LOGIN_RETRY_COOKIE } from "@/lib/session-cookie";
import { resolveAccountOAuthCallback } from "@/server/application/handle-account-oauth-callback";
import { getLaxAccountContainer } from "@/server/container";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** The landing page renders the notice; `/account` would bounce straight back to sign-in. */
function signInErrorRedirect(publicOrigin: string, reason: string): URL {
  const url = new URL("/", publicOrigin);
  url.searchParams.set("error", reason);
  return url;
}

export async function GET(request: Request): Promise<Response> {
  const container = getLaxAccountContainer();
  const publicOrigin = container.config.publicOrigin;
  const { secure, sessionCookie } = container.cookies;
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const clearLoginCookies = () => {
    cookieStore.delete(LAX_ACCOUNT_LOGIN_COOKIE);
    cookieStore.delete(LAX_ACCOUNT_LOGIN_RETRY_COOKIE);
  };

  const outcome = resolveAccountOAuthCallback(
    {
      code: url.searchParams.get("code"),
      state: url.searchParams.get("state"),
      oauthError: url.searchParams.get("error"),
      errorDescription: url.searchParams.get("error_description"),
    },
    {
      pendingRaw: cookieStore.get(LAX_ACCOUNT_LOGIN_COOKIE)?.value,
      hadLoginRetry: Boolean(cookieStore.get(LAX_ACCOUNT_LOGIN_RETRY_COOKIE)?.value),
    },
  );

  if (outcome.kind === "retry_login") {
    cookieStore.set(LAX_ACCOUNT_LOGIN_RETRY_COOKIE, "1", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60,
    });
    return NextResponse.redirect(new URL("/api/auth/login?returnTo=/account", publicOrigin));
  }
  if (outcome.kind === "login_error") {
    clearLoginCookies();
    return NextResponse.redirect(signInErrorRedirect(publicOrigin, outcome.reason));
  }
  if (outcome.kind !== "exchange") {
    clearLoginCookies();
    return NextResponse.redirect(signInErrorRedirect(publicOrigin, outcome.kind));
  }

  try {
    const result = await container.completeAccountLogin({
      config: container.config,
      pending: outcome.pending,
      receivedState: outcome.receivedState,
      code: outcome.code,
      sessions: container.sessions,
    });
    clearLoginCookies();
    cookieStore.set(sessionCookie, result.sessionId, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: container.config.sessionTtlSeconds,
    });
    return NextResponse.redirect(new URL(safeReturnTo(result.returnTo), publicOrigin));
  } catch {
    clearLoginCookies();
    return NextResponse.redirect(signInErrorRedirect(publicOrigin, "auth_failed"));
  }
}
