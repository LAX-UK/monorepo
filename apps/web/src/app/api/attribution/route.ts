import { CONSENT_COOKIE_NAME, parseConsentCookie } from "@/lib/analytics/consent/cookie";
import { isMarketingAttributionEnabled } from "@/lib/analytics/is-marketing-attribution-enabled";
import type { MarketingAttributionSnapshot } from "@auction/types";
import { parseMarketingAttributionSnapshot } from "@auction/validators/marketing-attribution";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "_lax_attr";
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 90;
const COOKIE_VALUE_MAX_CHARS = 3_800;

function cookieDomain(): string | undefined {
  const value = process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim();
  return value || undefined;
}

/**
 * Behind the platform proxy `request.url` carries the container's internal address, so the
 * browser's Origin is compared with the public host the proxy forwards instead.
 */
function requestIsSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const publicHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.split(",")[0]?.trim() ||
    new URL(request.url).host;
  return originHost === publicHost;
}

function setAttributionCookie(
  response: NextResponse,
  snapshot: MarketingAttributionSnapshot,
): boolean {
  const value = JSON.stringify(snapshot);
  // Next's cookie serializer performs this encoding once.
  if (encodeURIComponent(value).length > COOKIE_VALUE_MAX_CHARS) return false;
  const domain = cookieDomain();
  response.cookies.set(COOKIE_NAME, value, {
    path: "/",
    maxAge: COOKIE_MAX_AGE_SEC,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    ...(domain ? { domain } : {}),
  });
  return true;
}

export async function POST(request: Request): Promise<Response> {
  if (!isMarketingAttributionEnabled()) return new NextResponse(null, { status: 404 });
  if (!requestIsSameOrigin(request)) return new NextResponse(null, { status: 403 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const snapshot = parseMarketingAttributionSnapshot(
    (body as { snapshot?: unknown } | null)?.snapshot,
  );
  if (!snapshot) {
    return NextResponse.json({ error: "invalid_attribution_snapshot" }, { status: 400 });
  }

  const jar = await cookies();
  const consent = parseConsentCookie(jar.get(CONSENT_COOKIE_NAME)?.value);
  if (consent?.marketing !== true) return new NextResponse(null, { status: 403 });

  const response = new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
  if (!setAttributionCookie(response, snapshot)) {
    return NextResponse.json({ error: "attribution_cookie_too_large" }, { status: 413 });
  }
  return response;
}

export async function DELETE(request: Request): Promise<Response> {
  if (!requestIsSameOrigin(request)) return new NextResponse(null, { status: 403 });
  const response = new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
  const domain = cookieDomain();
  response.cookies.set(COOKIE_NAME, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    ...(domain ? { domain } : {}),
  });
  return response;
}
