import { openPendingLogin } from "@/lib/pending-login-cookie";
import { safeReturnTo } from "@/lib/safe-return-to";
import { LAX_ACCOUNT_LOGIN_COOKIE, LAX_ACCOUNT_LOGIN_RETRY_COOKIE } from "@/lib/session-cookie";
import { PendingLoginEndedError } from "@/server/application/complete-account-login";
import { discardReplacedSession } from "@/server/application/discard-replaced-session";
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
  const { secure, sessionCookie, loginCookie } = container.cookies;
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const clearLoginCookies = () => {
    // `__Host-` cookies are only cleared by a Set-Cookie that repeats Secure and Path=/.
    cookieStore.set(loginCookie, "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
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
      // A missing, unsigned or altered cookie reads as an expired sign-in: the flow restarts.
      pendingRaw: openPendingLogin(
        cookieStore.get(loginCookie)?.value,
        container.config.sessionEncryptionKey,
      ),
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

  const replacedSessionId = cookieStore.get(sessionCookie)?.value;
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
    if (outcome.pending.reauth) {
      await discardReplacedSession({
        replacedSessionId,
        newSessionId: result.sessionId,
        sessions: container.sessions,
      });
    }
    return NextResponse.redirect(new URL(safeReturnTo(result.returnTo), publicOrigin));
  } catch (error) {
    clearLoginCookies();
    // Signed out while this sign-in was in flight: the browser stays signed out, and the landing
    // page is shown without an error. A callback that was merely already taken (a retry after a
    // failed exchange) shows the normal sign-in error, unless this browser is signed in already.
    if (error instanceof PendingLoginEndedError && (error.signedOut || replacedSessionId)) {
      return NextResponse.redirect(new URL("/", publicOrigin));
    }
    return NextResponse.redirect(signInErrorRedirect(publicOrigin, "auth_failed"));
  }
}
