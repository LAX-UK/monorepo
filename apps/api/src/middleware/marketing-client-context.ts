import { createMiddleware } from "hono/factory";

export type MarketingClientContextVars = {
  marketingClientIp?: string;
  marketingClientUserAgent?: string;
};

export const MARKETING_PAGE_URL_HEADER = "x-lax-page-url";

function firstForwardedFor(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const first = header.split(",")[0]?.trim();
  return first && first.length > 0 ? first : undefined;
}

export function createMarketingClientContextMiddleware() {
  return createMiddleware<{ Variables: MarketingClientContextVars }>(async (c, next) => {
    const ip = firstForwardedFor(c.req.header("x-forwarded-for"));
    const ua = c.req.header("user-agent")?.trim();
    if (ip) c.set("marketingClientIp", ip);
    if (ua) c.set("marketingClientUserAgent", ua);
    await next();
  });
}
