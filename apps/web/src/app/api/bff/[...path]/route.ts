import { BID_API_AUDIENCE, bffConfig } from "@/lib/bff/config.server";
import {
  APPROVED_PROXY_METHODS,
  UNSAFE_PROXY_METHODS,
  isApprovedProxyPath,
  sanitizedProxyRequestHeaders,
  sanitizedProxyResponseHeaders,
  scopesForProxyMethod,
} from "@/lib/bff/proxy-policy";
import { readBidSessionId } from "@/lib/bff/session-cookie.server";
import { TokenRefreshFailedError, sendWithKeyRetry } from "@/lib/bff/token-key-retry.server";
import { BidBffSessionRequiredError, BidBffTokenService } from "@/lib/bff/token-service.server";
import { fetchBidApi } from "@/lib/data/http/bid-api.server";
import { resolveVisitorIp } from "@/lib/http/visitor-ip";
import { visitorIpHeadersFor } from "@/lib/http/visitor-ip.server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withHeaders(headers: Headers, extra: Record<string, string>): Headers {
  for (const [name, value] of Object.entries(extra)) headers.set(name, value);
  return headers;
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
  const method = request.method.toUpperCase();
  const { path } = await context.params;
  if (!APPROVED_PROXY_METHODS.has(method) || !isApprovedProxyPath(path)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const config = bffConfig();
  if (UNSAFE_PROXY_METHODS.has(method)) {
    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    if (origin !== config.publicOrigin || (fetchSite && fetchSite !== "same-origin")) {
      return NextResponse.json({ error: "csrf_rejected" }, { status: 403 });
    }
  }
  // The server clock is public: no session, so no token exchange to skew the round trip, and the
  // visitor's own address goes to the API so the rate limit is per visitor, not per web server.
  const isServerTime = path.length === 1 && path[0] === "time";
  const sessionId = isServerTime ? null : readBidSessionId(request);

  const tokens = new BidBffTokenService();
  const requiredScopes = scopesForProxyMethod(method);
  let resource: Awaited<ReturnType<BidBffTokenService["resourceToken"]>> | null;
  try {
    resource = sessionId
      ? await tokens.resourceToken(sessionId, BID_API_AUDIENCE, requiredScopes)
      : null;
  } catch (error) {
    if (error instanceof BidBffSessionRequiredError) {
      return NextResponse.json({ error: "session_required" }, { status: 401 });
    }
    return NextResponse.json({ error: "identity_unavailable" }, { status: 503 });
  }

  const target = new URL(`/${path.map(encodeURIComponent).join("/")}`, config.apiBaseUrl);
  target.search = request.nextUrl.search;
  const body =
    method === "GET" || method === "HEAD" ? undefined : Buffer.from(await request.arrayBuffer());
  const forwardedAddress = isServerTime
    ? visitorIpHeadersFor(resolveVisitorIp(request.headers))
    : {};
  const perform = (bearer?: string) =>
    fetchBidApi(target, {
      method,
      headers: withHeaders(sanitizedProxyRequestHeaders(request.headers, bearer), forwardedAddress),
      ...(body ? { body } : {}),
      redirect: "manual",
      cache: "no-store",
    });
  try {
    const { response: upstream } = await sendWithKeyRetry({
      resource,
      refresh: () =>
        tokens.resourceToken(sessionId as string, BID_API_AUDIENCE, requiredScopes, true),
      send: perform,
    });
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: sanitizedProxyResponseHeaders(upstream.headers),
    });
  } catch (error) {
    if (error instanceof TokenRefreshFailedError) {
      return error.cause instanceof BidBffSessionRequiredError
        ? NextResponse.json({ error: "session_required" }, { status: 401 })
        : NextResponse.json({ error: "identity_unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: "api_unavailable" }, { status: 502 });
  }
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
