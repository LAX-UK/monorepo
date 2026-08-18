import { exchangeAuthorizationCode, validateCallbackState } from "@/lib/bff/oidc.server";
import { getBffRedis } from "@/lib/bff/redis.server";
import {
  clearBidSessionCookie,
  readBidSessionId,
  setBidSessionCookie,
} from "@/lib/bff/session-cookie.server";
import { BidBffSessionStore } from "@/lib/bff/session-store.server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const id = readBidSessionId(request);
  const sessions = new BidBffSessionStore(getBffRedis());
  const pending = id ? await sessions.read(id) : null;
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");

  if (!id || pending?.kind !== "pending" || !validateCallbackState(pending.state, state) || !code) {
    if (id) await sessions.invalidate(id);
    const response = NextResponse.redirect(new URL("/login?error=oidc_callback", request.url), 303);
    clearBidSessionCookie(response);
    return response;
  }

  try {
    const authenticated = await exchangeAuthorizationCode({
      code,
      codeVerifier: pending.codeVerifier,
      nonce: pending.nonce,
    });
    const authenticatedId = await sessions.rotateAuthenticated(id, authenticated);
    if (!authenticatedId) throw new Error("Login session rotation failed");
    const response = NextResponse.redirect(new URL(pending.nextPath, request.url), 303);
    setBidSessionCookie(response, authenticatedId, "authenticated");
    response.headers.set("cache-control", "no-store");
    return response;
  } catch {
    await sessions.invalidate(id);
    const response = NextResponse.redirect(new URL("/login?error=oidc_exchange", request.url), 303);
    clearBidSessionCookie(response);
    return response;
  }
}
