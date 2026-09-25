import {
  authorizeParamsForEntry,
  pendingIntentForStorage,
  resolveHostedAuthEntry,
} from "@/lib/bff/auth-entry-intent.server";
import { buildAuthorizationUrl, createLoginProof } from "@/lib/bff/oidc.server";
import { getBffRedis } from "@/lib/bff/redis.server";
import { readBidSessionId, setBidSessionCookie } from "@/lib/bff/session-cookie.server";
import { BidBffSessionStore } from "@/lib/bff/session-store.server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const entry = resolveHostedAuthEntry(request.nextUrl.searchParams);
  const authorizeParams = authorizeParamsForEntry(entry);
  const proof = createLoginProof();
  const storedIntent = pendingIntentForStorage(entry);
  const sessions = new BidBffSessionStore(getBffRedis());
  const existingId = readBidSessionId(request);
  const existing = existingId ? await sessions.read(existingId) : null;
  const replacesSessionId = existing?.kind === "authenticated" ? existingId : undefined;

  const pendingSession = {
    kind: "pending" as const,
    state: proof.state,
    nonce: proof.nonce,
    codeVerifier: proof.codeVerifier,
    nextPath: entry.nextPath,
    ...(entry.inviteToken ? { inviteToken: entry.inviteToken } : {}),
    ...(replacesSessionId ? { replacesSessionId } : {}),
  };
  const sessionId = await sessions.createPending(
    storedIntent ? { ...pendingSession, entryIntent: storedIntent } : pendingSession,
  );
  const response = NextResponse.redirect(
    buildAuthorizationUrl({ ...proof, ...authorizeParams }),
    302,
  );
  setBidSessionCookie(response, sessionId, "login");
  response.headers.set("cache-control", "no-store");
  return response;
}
