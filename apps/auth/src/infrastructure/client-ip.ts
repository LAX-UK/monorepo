import { BlockList, isIP } from "node:net";
import { CLIENT_IP_HEADER_NAMES } from "@auction/auth";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";

export type ClientIpResolver = (context: Context) => string;

function normalizedIp(value: string | undefined): string | null {
  const candidate = value?.trim();
  return candidate && isIP(candidate) !== 0 ? candidate : null;
}

function createTrustedProxyMatcher(
  cidrs: readonly string[],
  envName = "AUTH_TRUSTED_PROXY_CIDRS",
): (address: string) => boolean {
  const blockList = new BlockList();
  for (const cidr of cidrs) {
    const [address, prefix, ...extra] = cidr.trim().split("/");
    const version = isIP(address ?? "");
    if (!address || version === 0 || extra.length > 0) {
      throw new Error(`Invalid ${envName} entry: ${cidr}`);
    }
    const type = version === 4 ? "ipv4" : "ipv6";
    if (prefix === undefined) {
      blockList.addAddress(address, type);
      continue;
    }
    const prefixLength = Number(prefix);
    const maxPrefixLength = version === 4 ? 32 : 128;
    if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > maxPrefixLength) {
      throw new Error(`Invalid ${envName} prefix: ${cidr}`);
    }
    blockList.addSubnet(address, prefixLength, type);
  }
  return (address) => {
    const version = isIP(address);
    return version !== 0 && blockList.check(address, version === 4 ? "ipv4" : "ipv6");
  };
}

/**
 * Same rules as `@auction/http-headers/client-ip`, kept as a copy because Identity may not depend
 * on other workspace packages (docs/architecture/09-lax-identity-boundary.md). Change both together.
 */
export function resolveClientIp(input: {
  /** Proxies we operate that append to the chain; the right-most `n - 1` entries are skipped. */
  trustedProxyHops?: number;
  remoteAddress: string | undefined;
  forwardedFor: string | undefined;
  realIp: string | undefined;
  cfConnectingIp: string | undefined;
  doConnectingIp: string | undefined;
  isTrustedProxy: (address: string) => boolean;
  isTrustedCloudflareProxy: (address: string) => boolean;
}): string {
  const remoteAddress = normalizedIp(input.remoteAddress);
  if (!remoteAddress) return "unknown";
  if (!input.isTrustedProxy(remoteAddress)) return remoteAddress;

  const doConnectingIp = normalizedIp(input.doConnectingIp);
  if (doConnectingIp) {
    const cfConnectingIp = normalizedIp(input.cfConnectingIp);
    if (cfConnectingIp && input.isTrustedCloudflareProxy(doConnectingIp)) {
      return cfConnectingIp;
    }
    return doConnectingIp;
  }

  if (input.forwardedFor) {
    const forwardedChain = input.forwardedFor.split(",").map((value) => normalizedIp(value));
    if (forwardedChain.some((address) => address === null)) return remoteAddress;
    const entries = forwardedChain as string[];
    const firstOwnHop = entries.length - Math.max(0, (input.trustedProxyHops ?? 1) - 1);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const hop = entries[index];
      if (!hop || index >= firstOwnHop) continue;
      if (!input.isTrustedProxy(hop) && !input.isTrustedCloudflareProxy(hop)) return hop;
    }
    // Every hop is one of ours: never fall back to the leftmost, client-controlled entry.
    return remoteAddress;
  }

  return normalizedIp(input.realIp) ?? remoteAddress;
}

export function createClientIpResolver(
  trustedProxyCidrs: readonly string[],
  trustedCloudflareProxyCidrs: readonly string[] = [],
  trustedProxyHops = 1,
): ClientIpResolver {
  const isTrustedProxy = createTrustedProxyMatcher(trustedProxyCidrs);
  const isTrustedCloudflareProxy = createTrustedProxyMatcher(
    trustedCloudflareProxyCidrs,
    "AUTH_TRUSTED_CLOUDFLARE_PROXY_CIDRS",
  );
  return (context) => {
    let remoteAddress: string | undefined;
    try {
      remoteAddress = getConnInfo(context).remote.address;
    } catch {
      remoteAddress = undefined;
    }
    return resolveClientIp({
      remoteAddress,
      forwardedFor: context.req.header(CLIENT_IP_HEADER_NAMES.forwardedFor),
      realIp: context.req.header(CLIENT_IP_HEADER_NAMES.realIp),
      cfConnectingIp: context.req.header(CLIENT_IP_HEADER_NAMES.cloudflare),
      doConnectingIp: context.req.header(CLIENT_IP_HEADER_NAMES.digitalOcean),
      trustedProxyHops,
      isTrustedProxy,
      isTrustedCloudflareProxy,
    });
  };
}
