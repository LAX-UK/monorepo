import { createMiddleware } from "hono/factory";
import { clientIpOrNull } from "./client-ip.js";

export type MarketingClientContextVars = {
  marketingClientIp?: string;
  marketingClientUserAgent?: string;
};

export const MARKETING_PAGE_URL_HEADER = "x-lax-page-url";

export function createMarketingClientContextMiddleware() {
  return createMiddleware<{ Variables: MarketingClientContextVars }>(async (c, next) => {
    const ip = clientIpOrNull(c);
    const ua = c.req.header("user-agent")?.trim();
    if (ip) c.set("marketingClientIp", ip);
    if (ua) c.set("marketingClientUserAgent", ua);
    await next();
  });
}
