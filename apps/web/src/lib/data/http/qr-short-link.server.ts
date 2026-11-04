import "server-only";

import { getServerApiBase } from "@/lib/data/http/hc-server";
import { resolveVisitorIp } from "@/lib/http/visitor-ip";
import { visitorIpHeadersFor } from "@/lib/http/visitor-ip.server";

/** Forwards scan-relevant client headers used by the API for privacy-minimized analytics. */
export function buildQrForwardHeaders(request: Request): Headers {
  const headers = new Headers();
  const userAgent = request.headers.get("user-agent");
  const referer = request.headers.get("referer");
  if (userAgent) headers.set("user-agent", userAgent);
  if (referer) headers.set("referer", referer);
  for (const [name, value] of Object.entries(
    visitorIpHeadersFor(resolveVisitorIp(request.headers)),
  )) {
    headers.set(name, value);
  }
  return headers;
}

export async function proxyQrShortLink(shortCode: string, request: Request): Promise<Response> {
  const apiBase = getServerApiBase();
  return fetch(`${apiBase}/q/${encodeURIComponent(shortCode)}`, {
    method: "GET",
    headers: buildQrForwardHeaders(request),
    redirect: "manual",
    cache: "no-store",
  });
}
