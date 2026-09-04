import { bffConfig } from "@/lib/bff/config.server";
import { buildEndSessionUrl } from "@/lib/bff/oidc.server";
import { getBffRedis } from "@/lib/bff/redis.server";
import { clearBidSessionCookie, readBidSessionId } from "@/lib/bff/session-cookie.server";
import { BidBffSessionStore } from "@/lib/bff/session-store.server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== bffConfig().publicOrigin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const id = readBidSessionId(request);
  const sessions = new BidBffSessionStore(getBffRedis());
  const session = id ? await sessions.read(id) : null;
  await sessions.invalidate(id);
  const response = NextResponse.json({
    redirectTo:
      session?.kind === "authenticated"
        ? buildEndSessionUrl(session.idToken).toString()
        : bffConfig().postLogoutRedirectUri,
  });
  clearBidSessionCookie(response);
  response.headers.set("cache-control", "no-store");
  return response;
}
