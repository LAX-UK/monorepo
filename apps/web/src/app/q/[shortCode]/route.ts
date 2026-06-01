import { getServerApiBase } from "@/lib/data/http/hc-server";
import { NextResponse } from "next/server";

/** Forwards the upstream noindex hint so proxied QR responses keep the same SEO posture. */
function copyRobotsTag(from: Response, to: NextResponse): void {
  const robots = from.headers.get("x-robots-tag");
  if (robots) to.headers.set("X-Robots-Tag", robots);
}

/** Copies scan-relevant client headers used by the API for privacy-minimized analytics. */
function buildForwardHeaders(request: Request): Headers {
  const headers = new Headers();
  const userAgent = request.headers.get("user-agent");
  const referer = request.headers.get("referer");
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  if (userAgent) headers.set("user-agent", userAgent);
  if (referer) headers.set("referer", referer);
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
  else if (realIp) headers.set("x-forwarded-for", realIp);
  return headers;
}

/** Proxies branded QR short links to the API redirect handler for local/split-stack dev.
 * On App Platform prod, DO ingress routes `/q/*` on the web hostname directly to the API. */
export async function GET(request: Request, context: { params: Promise<{ shortCode: string }> }) {
  const { shortCode } = await context.params;
  const apiBase = getServerApiBase();

  let res: Response;
  try {
    res = await fetch(`${apiBase}/q/${encodeURIComponent(shortCode)}`, {
      method: "GET",
      headers: buildForwardHeaders(request),
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "qr_upstream_unavailable" }, { status: 502 });
  }

  const location = res.headers.get("location");
  if ((res.status === 301 || res.status === 302) && location) {
    const out = NextResponse.redirect(location, res.status);
    copyRobotsTag(res, out);
    return out;
  }

  const out = new NextResponse(await res.text(), { status: res.status });
  copyRobotsTag(res, out);
  return out;
}
