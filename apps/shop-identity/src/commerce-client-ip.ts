import {
  DEFAULT_TRUSTED_PROXY_CIDRS,
  createClientIpPolicy,
  parseCidrList,
  parseTrustedProxyHops,
  resolveClientIpFromHeaders,
} from "@auction/http-headers/client-ip";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";

/** Container-network ranges this service sits behind, on top of the platform ingress range. */
const COMMERCE_TRUSTED_PROXY_CIDRS = [
  "127.0.0.1",
  "::1",
  ...DEFAULT_TRUSTED_PROXY_CIDRS,
  "172.16.0.0/12",
  "192.168.0.0/16",
] as const;

const policy = createClientIpPolicy({
  trustedProxyCidrs: parseCidrList(process.env.TRUSTED_PROXY_CIDRS, COMMERCE_TRUSTED_PROXY_CIDRS),
  trustedProxyHops: parseTrustedProxyHops(process.env.TRUSTED_PROXY_HOPS),
});

/** Visitor address for commerce rate limits and audit; resolved by the shared client-IP rules. */
export function commerceClientIp(c: Context): string {
  let remoteAddress: string | undefined;
  try {
    remoteAddress = getConnInfo(c).remote.address;
  } catch {
    remoteAddress = undefined;
  }
  return resolveClientIpFromHeaders((name) => c.req.header(name), policy, { remoteAddress });
}
