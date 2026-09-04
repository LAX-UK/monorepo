import { createHash, randomBytes } from "node:crypto";
import { BID_API_AUDIENCE, WS_AUDIENCE, bffConfig } from "@/lib/bff/config.server";
import { ensureBffRedisConnected, getBffRedis } from "@/lib/bff/redis.server";
import { readBidSessionId } from "@/lib/bff/session-cookie.server";
import { BidBffTokenService } from "@/lib/bff/token-service.server";
import { fetchBidApi } from "@/lib/data/http/bid-api.server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (
    request.headers.get("origin") !== bffConfig().publicOrigin ||
    (request.headers.get("sec-fetch-site") &&
      request.headers.get("sec-fetch-site") !== "same-origin")
  ) {
    return NextResponse.json({ error: "csrf_rejected" }, { status: 403 });
  }
  const sessionId = readBidSessionId(request);
  if (!sessionId) return NextResponse.json({ error: "session_required" }, { status: 401 });
  try {
    const tokens = new BidBffTokenService();
    const apiResource = await tokens.resourceToken(sessionId, BID_API_AUDIENCE, "bid.read");
    const wsResource = await tokens.resourceToken(sessionId, WS_AUDIENCE, "bid.read");
    const meResponse = await fetchBidApi(`${bffConfig().apiBaseUrl}/users/me`, {
      headers: { authorization: `Bearer ${apiResource.token}`, accept: "application/json" },
      cache: "no-store",
    });
    const me = (await meResponse.json()) as {
      data?: { id?: string; role?: string; staffRole?: string | null };
    };
    if (
      !meResponse.ok ||
      me.data?.id !== apiResource.session.subject ||
      typeof me.data.role !== "string"
    ) {
      return NextResponse.json({ error: "session_required" }, { status: 401 });
    }
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
        staffRole: me.data.staffRole ?? null,
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
  } catch {
    return NextResponse.json({ error: "session_required" }, { status: 401 });
  }
}
