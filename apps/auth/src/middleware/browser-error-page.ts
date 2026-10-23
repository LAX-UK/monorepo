import {
  type HostedAuthCapabilities,
  buildHostedErrorHtml,
  hostedAuthViewFromSearch,
  isBrowserNavigation,
} from "@auction/auth";
import { createMiddleware } from "hono/factory";

/**
 * A person who follows a link that fails (an expired magic link, a bad authorize request)
 * would otherwise see raw JSON. Navigations get a branded page with a way back; fetch/XHR
 * and server-to-server callers keep the JSON they parse.
 */
export function createBrowserErrorPageMiddleware(capabilities: HostedAuthCapabilities) {
  return createMiddleware(async (c, next) => {
    await next();
    const status = c.res.status;
    if (status < 400) return;
    if (!(c.res.headers.get("content-type") ?? "").includes("application/json")) return;
    if (!isBrowserNavigation(c.req.raw.headers)) return;
    const view = hostedAuthViewFromSearch(new URL(c.req.url).searchParams, capabilities);
    c.res = new Response(buildHostedErrorHtml(status, view), {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  });
}
