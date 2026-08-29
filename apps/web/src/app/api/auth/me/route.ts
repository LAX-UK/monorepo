import { BID_API_AUDIENCE, bffConfig } from "@/lib/bff/config.server";
import { readBidSessionId } from "@/lib/bff/session-cookie.server";
import { BidBffSessionRequiredError, BidBffTokenService } from "@/lib/bff/token-service.server";
import { fetchBidApi } from "@/lib/data/http/bid-api.server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ciDebug(extra: Record<string, unknown>): Record<string, unknown> {
  return process.env.CI === "true" ? extra : {};
}

export async function GET(request: NextRequest) {
  const sessionId = readBidSessionId(request);
  if (!sessionId) {
    return NextResponse.json(
      { authenticated: false, ...ciDebug({ reason: "missing_session_cookie" }) },
      { status: 401 },
    );
  }
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
    if (!response.ok) {
      return NextResponse.json(
        {
          authenticated: false,
          ...ciDebug({ reason: "api_profile_rejected", apiStatus: response.status }),
        },
        { status: 401 },
      );
    }
    const body = await response.json();
    return NextResponse.json(
      { authenticated: true, ...(body as object) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const reason =
      error instanceof BidBffSessionRequiredError
        ? "bff_session_not_authenticated"
        : "bff_token_error";
    return NextResponse.json(
      {
        authenticated: false,
        ...ciDebug({
          reason,
          ...(error instanceof Error ? { message: error.message } : {}),
        }),
      },
      { status: 401 },
    );
  }
}
