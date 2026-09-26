import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import {
  clearBidSilentSuppressed,
  markBidSilentGuestResult,
  markBidSilentQuiet,
} from "@/lib/auth/silent-sign-in/cookies.server";
import { exchangeAuthorizationCode, validateCallbackState } from "@/lib/bff/oidc.server";
import { setOnboardingInviteCookie } from "@/lib/bff/onboarding-invite-cookie.server";
import { resolvePublicOriginUrl } from "@/lib/bff/public-origin-url.server";
import { getBffRedis } from "@/lib/bff/redis.server";
import {
  clearBidSessionCookie,
  readBidSessionId,
  setBidSessionCookie,
} from "@/lib/bff/session-cookie.server";
import { BidBffSessionStore, type PendingBidSession } from "@/lib/bff/session-store.server";
import { classifySilentCallback } from "@auction/identity-rp";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function loginErrorPath(
  error: string,
  pending: Pick<PendingBidSession, "nextPath" | "entryIntent">,
  restored: boolean,
): string {
  const q = new URLSearchParams({ error, next: pending.nextPath });
  if (restored) q.set("restored", "1");
  if (pending.entryIntent === "reauth") q.set("intent", "reauth");
  return `/login?${q.toString()}`;
}

async function buildLoginFailureResponse(
  sessions: BidBffSessionStore,
  loginPath: string,
  replacesSessionId: string | undefined,
): Promise<NextResponse> {
  const response = NextResponse.redirect(resolvePublicOriginUrl(loginPath), 302);
  if (replacesSessionId) {
    const restored = await sessions.read(replacesSessionId);
    if (restored?.kind === "authenticated") {
      setBidSessionCookie(response, replacesSessionId, "authenticated");
      return response;
    }
  }
  clearBidSessionCookie(response);
  return response;
}

function redirectSilentGuest(nextPath: string): NextResponse {
  const safePath = isSafeNextPath(nextPath) ? nextPath : "/dashboard";
  const response = NextResponse.redirect(resolvePublicOriginUrl(safePath), 302);
  clearBidSessionCookie(response);
  markBidSilentQuiet(response);
  markBidSilentGuestResult(response);
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const id = readBidSessionId(request);
  const sessions = new BidBffSessionStore(getBffRedis());
  const pending = id ? await sessions.read(id) : null;
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");
  const replacesSessionId = pending?.kind === "pending" ? pending.replacesSessionId : undefined;
  const pendingCtx: Pick<PendingBidSession, "nextPath" | "entryIntent"> =
    pending?.kind === "pending"
      ? {
          nextPath: pending.nextPath,
          ...(pending.entryIntent !== undefined ? { entryIntent: pending.entryIntent } : {}),
        }
      : { nextPath: "/dashboard" };

  if (pending?.kind === "pending" && pending.entryIntent === "silent") {
    const silentOutcome = classifySilentCallback(oauthError);
    if (silentOutcome.kind !== "success" || !code) {
      if (id) await sessions.invalidate(id);
      return redirectSilentGuest(pending.nextPath);
    }
  }

  if (!id || pending?.kind !== "pending" || !validateCallbackState(pending.state, state) || !code) {
    if (id) await sessions.invalidate(id);
    const restored = Boolean(replacesSessionId);
    return buildLoginFailureResponse(
      sessions,
      loginErrorPath("oidc_callback", pendingCtx, restored),
      replacesSessionId,
    );
  }

  try {
    const replacedSession =
      replacesSessionId && pending.entryIntent === "reauth"
        ? await sessions.read(replacesSessionId)
        : null;
    const authenticated = await exchangeAuthorizationCode({
      code,
      codeVerifier: pending.codeVerifier,
      nonce: pending.nonce,
      requireRecentAuthentication: pending.entryIntent === "reauth",
      maxAgeSeconds: 300,
    });
    if (
      pending.entryIntent === "reauth" &&
      replacedSession?.kind === "authenticated" &&
      replacedSession.subject !== authenticated.subject
    ) {
      await sessions.invalidate(id);
      return buildLoginFailureResponse(
        sessions,
        loginErrorPath("reauth_subject_mismatch", pendingCtx, true),
        replacesSessionId,
      );
    }
    const authenticatedId = await sessions.rotateAuthenticated(id, authenticated);
    if (!authenticatedId) throw new Error("Login session rotation failed");
    if (replacesSessionId && replacesSessionId !== authenticatedId) {
      await sessions.invalidate(replacesSessionId);
    }
    const postLogin = new URL("/auth/post-login", resolvePublicOriginUrl("/"));
    postLogin.searchParams.set("next", pending.nextPath);
    postLogin.searchParams.set("auth_fresh", "1");
    if (pending.entryIntent) {
      postLogin.searchParams.set("entry_intent", pending.entryIntent);
    }
    const response = NextResponse.redirect(postLogin.toString(), 302);
    if (pending.inviteToken) {
      setOnboardingInviteCookie(response, pending.inviteToken);
    }
    clearBidSilentSuppressed(response);
    setBidSessionCookie(response, authenticatedId, "authenticated");
    response.headers.set("cache-control", "no-store");
    return response;
  } catch {
    await sessions.invalidate(id);
    if (pending.entryIntent === "silent") {
      return redirectSilentGuest(pending.nextPath);
    }
    const restored = Boolean(replacesSessionId);
    return buildLoginFailureResponse(
      sessions,
      loginErrorPath("oidc_exchange", pendingCtx, restored),
      replacesSessionId,
    );
  }
}
