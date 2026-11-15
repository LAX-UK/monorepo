import { openPendingLogin } from "@/lib/pending-login-cookie";
import { LAX_ACCOUNT_LOGIN_COOKIE, LAX_ACCOUNT_LOGIN_RETRY_COOKIE } from "@/lib/session-cookie";
import { endPendingAccountLogin } from "@/server/application/complete-account-login";
import type { PendingAccountLogin } from "@/server/application/start-account-login";
import { getLaxAccountContainer } from "@/server/container";
import { buildEndSessionUrl } from "@auction/identity-rp";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<Response> {
  const container = getLaxAccountContainer();
  if (request.headers.get("origin") !== container.config.publicOrigin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const { secure, sessionCookie, loginCookie } = container.cookies;
  const cookieStore = await cookies();
  // A sign-in still in flight (such as a "Confirm it's you" window) must not sign this browser
  // back in when its callback arrives after this: it is ended here, and its cookie cleared.
  const pendingRaw = openPendingLogin(
    cookieStore.get(loginCookie)?.value,
    container.config.sessionEncryptionKey,
  );
  if (pendingRaw) {
    try {
      const pending = JSON.parse(pendingRaw) as Pick<PendingAccountLogin, "state">;
      if (typeof pending.state === "string" && pending.state) {
        await endPendingAccountLogin({ pending, sessions: container.sessions });
      }
    } catch (error) {
      // The cookie is still cleared below; without it the callback finds no sign-in to finish.
      console.error("account_logout_pending_login_end_failed", error);
    }
  }
  if (cookieStore.get(loginCookie)) {
    cookieStore.set(loginCookie, "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  for (const name of [LAX_ACCOUNT_LOGIN_COOKIE, LAX_ACCOUNT_LOGIN_RETRY_COOKIE]) {
    if (cookieStore.get(name)) cookieStore.delete(name);
  }
  const sessionId = cookieStore.get(sessionCookie)?.value ?? null;
  let idToken: string | undefined;
  if (sessionId) {
    try {
      const record = await container.sessions.get(sessionId);
      idToken = record?.idToken;
      await container.sessions.delete(sessionId);
    } catch (error) {
      // Sign-out must still end this browser's session when Redis is down: the cookie is
      // cleared below, and without the ID token the issuer is asked to end this browser's
      // sign-in on a same-site request instead.
      console.error("account_logout_session_store_failed", error);
      idToken = undefined;
    }
    // `__Host-` cookies are only cleared by a Set-Cookie that repeats Secure and Path=/.
    cookieStore.set(sessionCookie, "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  const landing = `${container.config.publicOrigin}/`;
  // No sign-in here to end, so nothing to ask the issuer.
  if (!sessionId) return NextResponse.redirect(landing, 303);
  // With no ID token the issuer ends the browser's own sign-in from its cookie, on this
  // same-site navigation, and sends the person back to the registered landing page.
  const redirectTo = buildEndSessionUrl({
    endSessionEndpoint: `${container.config.oidcIssuer}/api/auth/oauth2/endsession`,
    clientId: container.config.oidcClientId,
    postLogoutRedirectUri: landing,
    idTokenHint: idToken ?? null,
  });
  return NextResponse.redirect(redirectTo, 303);
}
