import { createHash, randomBytes } from "node:crypto";
import { TokenExchangeFailedError, fetchBidApiAsSession } from "@/lib/bff/bid-api-session.server";
import { WS_AUDIENCE, bffConfig } from "@/lib/bff/config.server";
import { ensureBffRedisConnected, getBffRedis } from "@/lib/bff/redis.server";
import { readBidSessionId } from "@/lib/bff/session-cookie.server";
import { BidBffSessionRequiredError, BidBffTokenService } from "@/lib/bff/token-service.server";
import { parseSessionUser } from "@/lib/data/http/parse/session.parse";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Upper bound for the identity check so a hung API surfaces as 503, not a hung socket. */
const API_TIMEOUT_MS = 10_000;

const SESSION_REQUIRED = () => NextResponse.json({ error: "session_required" }, { status: 401 });

/** Dependency failure: the person is still signed in and the client may try again. */
function ticketUnavailable(cause: unknown) {
  // Only the error class is logged: never tokens, cookies or user details.
  console.error("[ws-ticket] unavailable", cause instanceof Error ? cause.name : "unknown");
  return NextResponse.json(
    { error: "ws_ticket_unavailable" },
    { status: 503, headers: { "retry-after": "5", "cache-control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (
    request.headers.get("origin") !== bffConfig().publicOrigin ||
    (request.headers.get("sec-fetch-site") &&
      request.headers.get("sec-fetch-site") !== "same-origin")
  ) {
    return NextResponse.json({ error: "csrf_rejected" }, { status: 403 });
  }
  const sessionId = readBidSessionId(request);
  if (!sessionId) return SESSION_REQUIRED();
  try {
    const tokens = new BidBffTokenService();
    // A replaceable API token is swapped once; the ticket carries the token the API accepted,
    // never the rejected one.
    const { response: meResponse, resource: apiResource } = await fetchBidApiAsSession({
      sessionId,
      scopes: "bid.read",
      tokens,
      input: `${bffConfig().apiBaseUrl}/users/me`,
      init: (token) => ({
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      }),
    });
    if (meResponse.status === 401 || meResponse.status === 403) return SESSION_REQUIRED();
    if (!meResponse.ok) return ticketUnavailable(new Error(`API status ${meResponse.status}`));
    const me = (await meResponse.json()) as {
      data?: { id?: string; role?: string; staffRole?: unknown; staffRoles?: unknown };
    };
    if (me.data?.id !== apiResource.session.subject || typeof me.data.role !== "string") {
      return SESSION_REQUIRED();
    }
    const wsResource = await tokens.resourceToken(sessionId, WS_AUDIENCE, "bid.read");
    const ticket = randomBytes(32).toString("base64url");
    const key = `bid:ws-ticket:${createHash("sha256").update(ticket).digest("base64url")}`;
    const reserved = await (await ensureBffRedisConnected(getBffRedis())).set(
      key,
      JSON.stringify({
        subject: wsResource.session.subject,
        sid: wsResource.session.sid,
        audience: WS_AUDIENCE,
        scopes: ["bid.read"],
        role: me.data.role,
        // Roles in force when the ticket is issued; the socket server re-checks them live.
        staffRoles: parseSessionUser(me.data).staffRoles ?? [],
        apiResourceToken: apiResource.token,
      }),
      "EX",
      60,
      "NX",
    );
    if (reserved !== "OK") throw new Error("WS ticket collision");
    return NextResponse.json(
      { ticket, expiresIn: 60 },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof BidBffSessionRequiredError) return SESSION_REQUIRED();
    if (error instanceof TokenExchangeFailedError) {
      return error.cause instanceof BidBffSessionRequiredError
        ? SESSION_REQUIRED()
        : ticketUnavailable(error.cause);
    }
    return ticketUnavailable(error);
  }
}
