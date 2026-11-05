import { BlockList, isIP } from "node:net";

/**
 * The one place that decides which address a request came from. Forwarded headers are only
 * believed when the connection came from a proxy we operate; everything else about the client
 * is attacker-controlled. Server-only: it uses `node:net`, so import it from
 * `@auction/http-headers/client-ip`, never from browser code.
 */

export const CLIENT_IP_HEADER_NAMES = {
  cloudflare: "cf-connecting-ip",
  digitalOcean: "do-connecting-ip",
  forwardedFor: "x-forwarded-for",
  realIp: "x-real-ip",
} as const;

/** The address a trusted web server read for its visitor, sent to the API with the token below. */
export const SERVER_CLIENT_IP_HEADER = "x-lax-client-ip";
export const SERVER_CLIENT_IP_TOKEN_HEADER = "x-lax-client-ip-token";

export const UNKNOWN_CLIENT_IP = "unknown";

/** Private ranges of the platform ingress that sits in front of every app container. */
export const DEFAULT_TRUSTED_PROXY_CIDRS: readonly string[] = ["10.0.0.0/8"];

/** Cloudflare's published edge ranges (https://www.cloudflare.com/ips/). */
export const DEFAULT_CLOUDFLARE_PROXY_CIDRS: readonly string[] = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

export type AddressMatcher = (address: string) => boolean;

export function normalizedIp(value: string | undefined | null): string | null {
  const candidate = value?.trim();
  return candidate && isIP(candidate) !== 0 ? candidate : null;
}

/** Builds a matcher for a list of CIDRs (or bare addresses); throws on a malformed entry. */
export function createCidrMatcher(cidrs: readonly string[], label: string): AddressMatcher {
  const blockList = new BlockList();
  for (const cidr of cidrs) {
    const [address, prefix, ...extra] = cidr.trim().split("/");
    const version = isIP(address ?? "");
    if (!address || version === 0 || extra.length > 0) {
      throw new Error(`Invalid ${label} entry: ${cidr}`);
    }
    const type = version === 4 ? "ipv4" : "ipv6";
    if (prefix === undefined) {
      blockList.addAddress(address, type);
      continue;
    }
    const prefixLength = Number(prefix);
    const maxPrefixLength = version === 4 ? 32 : 128;
    if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > maxPrefixLength) {
      throw new Error(`Invalid ${label} prefix: ${cidr}`);
    }
    blockList.addSubnet(address, prefixLength, type);
  }
  return (address) => {
    const version = isIP(address);
    return version !== 0 && blockList.check(address, version === 4 ? "ipv4" : "ipv6");
  };
}

export type ClientIpPolicy = {
  isTrustedProxy: AddressMatcher;
  isTrustedCloudflareProxy: AddressMatcher;
};

export function createClientIpPolicy(
  options: {
    trustedProxyCidrs?: readonly string[];
    trustedCloudflareProxyCidrs?: readonly string[];
    trustedProxyLabel?: string;
    trustedCloudflareProxyLabel?: string;
  } = {},
): ClientIpPolicy {
  return {
    isTrustedProxy: createCidrMatcher(
      options.trustedProxyCidrs ?? DEFAULT_TRUSTED_PROXY_CIDRS,
      options.trustedProxyLabel ?? "trusted proxy CIDRs",
    ),
    isTrustedCloudflareProxy: createCidrMatcher(
      options.trustedCloudflareProxyCidrs ?? DEFAULT_CLOUDFLARE_PROXY_CIDRS,
      options.trustedCloudflareProxyLabel ?? "trusted Cloudflare CIDRs",
    ),
  };
}

/** Splits a comma-separated CIDR setting; empty or missing gives the fallback. */
export function parseCidrList(
  raw: string | undefined,
  fallback: readonly string[],
): readonly string[] {
  const parts = (raw ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : fallback;
}

export type ClientIpInput = ClientIpPolicy & {
  /** The TCP peer. Undefined when the runtime cannot tell (then the result is "unknown"). */
  remoteAddress: string | undefined;
  forwardedFor: string | undefined;
  realIp: string | undefined;
  cfConnectingIp: string | undefined;
  doConnectingIp: string | undefined;
  /**
   * For runtimes with no access to the TCP peer (Next.js server code). The request is then
   * assumed to have come through the platform ingress, which is the only way to reach the app.
   */
  peerBehindTrustedProxy?: boolean;
};

/**
 * 1. Peer not a trusted proxy: the peer itself; every header is ignored.
 * 2. `do-connecting-ip`, or the `cf-connecting-ip` behind it when that hop is a Cloudflare edge.
 * 3. `x-forwarded-for` walked from the right to the first hop that is not one of our proxies;
 *    a malformed chain is not believed.
 * 4. `x-real-ip`, then the peer.
 */
export function resolveClientIp(input: ClientIpInput): string {
  const remoteAddress = normalizedIp(input.remoteAddress);
  if (!remoteAddress && !input.peerBehindTrustedProxy) return UNKNOWN_CLIENT_IP;
  if (remoteAddress && !input.isTrustedProxy(remoteAddress)) return remoteAddress;
  const fallback = remoteAddress ?? UNKNOWN_CLIENT_IP;

  const doConnectingIp = normalizedIp(input.doConnectingIp);
  if (doConnectingIp) {
    const cfConnectingIp = normalizedIp(input.cfConnectingIp);
    if (cfConnectingIp && input.isTrustedCloudflareProxy(doConnectingIp)) {
      return cfConnectingIp;
    }
    return doConnectingIp;
  }

  if (input.forwardedFor) {
    const chain = input.forwardedFor.split(",").map((value) => normalizedIp(value));
    if (chain.some((address) => address === null)) return fallback;
    const hops = [...(chain as string[]), ...(remoteAddress ? [remoteAddress] : [])];
    for (let index = hops.length - 1; index >= 0; index -= 1) {
      const hop = hops[index];
      if (hop && !input.isTrustedProxy(hop) && !input.isTrustedCloudflareProxy(hop)) return hop;
    }
    return hops[0] ?? fallback;
  }

  return normalizedIp(input.realIp) ?? fallback;
}

type HeaderReader = (name: string) => string | null | undefined;

/** Resolves from a header reader (Hono `c.req.header` or Fetch `Headers#get`). */
export function resolveClientIpFromHeaders(
  readHeader: HeaderReader,
  policy: ClientIpPolicy,
  options: { remoteAddress?: string | undefined; peerBehindTrustedProxy?: boolean } = {},
): string {
  const read = (name: string) => readHeader(name) ?? undefined;
  return resolveClientIp({
    ...policy,
    remoteAddress: options.remoteAddress,
    ...(options.peerBehindTrustedProxy ? { peerBehindTrustedProxy: true } : {}),
    forwardedFor: read(CLIENT_IP_HEADER_NAMES.forwardedFor),
    realIp: read(CLIENT_IP_HEADER_NAMES.realIp),
    cfConnectingIp: read(CLIENT_IP_HEADER_NAMES.cloudflare),
    doConnectingIp: read(CLIENT_IP_HEADER_NAMES.digitalOcean),
  });
}

/** For Next.js server code, which sees headers but not the TCP peer. */
export function createServerClientIpResolver(
  env: {
    TRUSTED_PROXY_CIDRS?: string | undefined;
    TRUSTED_CLOUDFLARE_PROXY_CIDRS?: string | undefined;
  } = {},
): (headers: { get(name: string): string | null }) => string {
  const policy = createClientIpPolicy({
    trustedProxyCidrs: parseCidrList(env.TRUSTED_PROXY_CIDRS, DEFAULT_TRUSTED_PROXY_CIDRS),
    trustedCloudflareProxyCidrs: parseCidrList(
      env.TRUSTED_CLOUDFLARE_PROXY_CIDRS,
      DEFAULT_CLOUDFLARE_PROXY_CIDRS,
    ),
  });
  return (headers) =>
    resolveClientIpFromHeaders((name) => headers.get(name), policy, {
      peerBehindTrustedProxy: true,
    });
}

/**
 * Headers a server sends so the API keys its limits and audit trail on the visitor, not on the
 * server itself. Empty when the address is unknown or no token is configured.
 */
export function serverClientIpHeaders(
  clientIp: string,
  token: string | undefined,
): Record<string, string> {
  if (!token || normalizedIp(clientIp) === null) return {};
  return { [SERVER_CLIENT_IP_HEADER]: clientIp, [SERVER_CLIENT_IP_TOKEN_HEADER]: token };
}
