import "server-only";

import { getServerApiBase } from "@/lib/data/http/hc-server";

/** Forwards scan-relevant client headers used by the API for privacy-minimized analytics. */
export function buildQrForwardHeaders(request: Request): Headers {
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

export async function proxyQrShortLink(shortCode: string, request: Request): Promise<Response> {
  const apiBase = getServerApiBase();
  return fetch(`${apiBase}/q/${encodeURIComponent(shortCode)}`, {
    method: "GET",
    headers: buildQrForwardHeaders(request),
    redirect: "manual",
    cache: "no-store",
  });
}
