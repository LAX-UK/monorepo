import { TokenExchangeFailedError, fetchBidApiAsSession } from "@/lib/bff/bid-api-session.server";
import { bffConfig } from "@/lib/bff/config.server";
import { readBidSessionId } from "@/lib/bff/session-cookie.server";
import { BidBffSessionRequiredError } from "@/lib/bff/token-service.server";
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
    const { response } = await fetchBidApiAsSession({
      sessionId,
      scopes: "bid.read",
      input: `${bffConfig().apiBaseUrl}/users/me`,
      init: (token) => ({
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
        cache: "no-store",
      }),
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
    const exchangeError = error instanceof TokenExchangeFailedError ? error.cause : error;
    const reason =
      exchangeError instanceof BidBffSessionRequiredError
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
