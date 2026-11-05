import { createServerClientIpResolver } from "@auction/http-headers/client-ip";

/**
 * The visitor's address behind the platform ingress (this server never sees the TCP peer, so the
 * forwarded headers are read the way the shared resolver reads them). Never the first
 * forwarded entry: the browser chooses that one.
 */
export const resolveVisitorIp = createServerClientIpResolver({
  TRUSTED_PROXY_CIDRS: process.env.TRUSTED_PROXY_CIDRS,
  TRUSTED_CLOUDFLARE_PROXY_CIDRS: process.env.TRUSTED_CLOUDFLARE_PROXY_CIDRS,
});
