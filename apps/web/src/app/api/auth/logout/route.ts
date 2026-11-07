import { markBidSilentSuppressed } from "@/lib/auth/silent-sign-in/cookies.server";
import { bffConfig } from "@/lib/bff/config.server";
import { buildEndSessionUrl } from "@/lib/bff/oidc.server";
import { getBffRedis } from "@/lib/bff/redis.server";
import { clearBidSessionCookie, readBidSessionId } from "@/lib/bff/session-cookie.server";
import { BidBffSessionStore } from "@/lib/bff/session-store.server";
import { ACTING_LEGAL_ENTITY_COOKIE } from "@/lib/legal-entity/client-acting-context";
import { ACCOUNT_NOTICE_COOKIE } from "@/lib/navigation/account-notice";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== bffConfig().publicOrigin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const id = readBidSessionId(request);
  const sessions = new BidBffSessionStore(getBffRedis());
  const session = id ? await sessions.read(id) : null;
  // Also revokes a login still in flight, so a late OIDC callback cannot revive the session.
  await sessions.revoke(id);
  const response = NextResponse.json({
    redirectTo:
      session?.kind === "authenticated"
        ? buildEndSessionUrl(session.idToken).toString()
        : bffConfig().postLogoutRedirectUri,
  });
  clearBidSessionCookie(response);
  // The next person to sign in on this browser starts from their own account, not this one's:
  // signing in restores the right account, so the choice no longer has to outlive the session.
  response.cookies.delete(ACTING_LEGAL_ENTITY_COOKIE);
  response.cookies.delete(ACCOUNT_NOTICE_COOKIE);
  markBidSilentSuppressed(response);
  response.headers.set("cache-control", "no-store");
  return response;
}
