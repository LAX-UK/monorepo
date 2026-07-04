import { proxyQrShortLink } from "@/lib/data/http/qr-short-link.server";
import { NextResponse } from "next/server";

/** Forwards the upstream noindex hint so proxied QR responses keep the same SEO posture. */
function copyRobotsTag(from: Response, to: NextResponse): void {
  const robots = from.headers.get("x-robots-tag");
  if (robots) to.headers.set("X-Robots-Tag", robots);
}

/** Proxies branded QR short links to the API redirect handler for local/split-stack dev.
 * On App Platform prod, DO ingress routes `/q/*` on the web hostname directly to the API. */
export async function GET(request: Request, context: { params: Promise<{ shortCode: string }> }) {
  const { shortCode } = await context.params;

  let res: Response;
  try {
    res = await proxyQrShortLink(shortCode, request);
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
