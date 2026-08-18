import { BID_API_AUDIENCE, bffConfig } from "@/lib/bff/config.server";
import { readBidSessionId } from "@/lib/bff/session-cookie.server";
import { BidBffTokenService } from "@/lib/bff/token-service.server";
import { fetchBidApi } from "@/lib/data/http/bid-api.server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionId = readBidSessionId(request);
  if (!sessionId) return NextResponse.json({ authenticated: false }, { status: 401 });
  try {
    const resource = await new BidBffTokenService().resourceToken(
      sessionId,
      BID_API_AUDIENCE,
      "bid.read",
    );
    const response = await fetchBidApi(`${bffConfig().apiBaseUrl}/users/me`, {
      headers: { authorization: `Bearer ${resource.token}`, accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ authenticated: false }, { status: 401 });
    const body = await response.json();
    return NextResponse.json(
      { authenticated: true, ...(body as object) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
