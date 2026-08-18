import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { buildAuthorizationUrl, createLoginProof } from "@/lib/bff/oidc.server";
import { getBffRedis } from "@/lib/bff/redis.server";
import { setBidSessionCookie } from "@/lib/bff/session-cookie.server";
import { BidBffSessionStore } from "@/lib/bff/session-store.server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const proof = createLoginProof();
  const requestedNext = request.nextUrl.searchParams.get("next");
  const nextPath = requestedNext && isSafeNextPath(requestedNext) ? requestedNext : "/dashboard";
  const sessionId = await new BidBffSessionStore(getBffRedis()).createPending({
    kind: "pending",
    state: proof.state,
    nonce: proof.nonce,
    codeVerifier: proof.codeVerifier,
    nextPath,
  });
  const response = NextResponse.redirect(buildAuthorizationUrl(proof), 302);
  setBidSessionCookie(response, sessionId, "login");
  response.headers.set("cache-control", "no-store");
  return response;
}
