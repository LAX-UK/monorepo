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
import { BidBffSessionRequiredError, BidBffTokenService } from "@/lib/bff/token-service.server";
import { fetchBidApi } from "@/lib/data/http/bid-api.server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const sessionId = readBidSessionId(request);

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
  const perform = (bearer?: string) =>
    fetchBidApi(target, {
      method,
      headers: sanitizedProxyRequestHeaders(request.headers, bearer),
      ...(body ? { body } : {}),
      redirect: "manual",
      cache: "no-store",
    });
  try {
    let upstream = await perform(resource?.token);
    if (upstream.status === 401 && sessionId && resource) {
      try {
        resource = await tokens.resourceToken(sessionId, BID_API_AUDIENCE, requiredScopes, true);
      } catch (error) {
        if (error instanceof BidBffSessionRequiredError) {
          return NextResponse.json({ error: "session_required" }, { status: 401 });
        }
        return NextResponse.json({ error: "identity_unavailable" }, { status: 503 });
      }
      upstream = await perform(resource.token);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: sanitizedProxyResponseHeaders(upstream.headers),
    });
  } catch {
    return NextResponse.json({ error: "api_unavailable" }, { status: 502 });
  }
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
