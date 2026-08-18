import { bffConfig } from "@/lib/bff/config.server";
import { sanitizedProxyResponseHeaders } from "@/lib/bff/proxy-policy";
import { fetchBidApi } from "@/lib/data/http/bid-api.server";
import {
  displayProxyRequestHeaders,
  displayProxyRequestPolicy,
} from "@/lib/display/display-proxy-policy";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PAIR_POLL_BODY_BYTES = 4 * 1024;

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const policy = displayProxyRequestPolicy(request.method, path);
  if (!policy) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const config = bffConfig();
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    if (origin !== config.publicOrigin || (fetchSite && fetchSite !== "same-origin")) {
      return NextResponse.json({ error: "csrf_rejected" }, { status: 403 });
    }
  }

  const headers = displayProxyRequestHeaders(request.headers, policy, config.publicOrigin);
  if (!headers) {
    return NextResponse.json(
      { error: policy.requiresDisplayBearer ? "display_token_required" : "invalid_request" },
      { status: policy.requiresDisplayBearer ? 401 : 400 },
    );
  }

  let body: ArrayBuffer | undefined;
  if (policy.body === "json") {
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > MAX_PAIR_POLL_BODY_BYTES) {
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    }
    body = bytes;
  }

  try {
    const target = new URL(policy.upstreamPath, config.apiBaseUrl);
    const upstream = await fetchBidApi(target, {
      method: request.method,
      headers,
      ...(body ? { body } : {}),
      redirect: "manual",
      cache: "no-store",
    });
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: sanitizedProxyResponseHeaders(upstream.headers),
    });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
