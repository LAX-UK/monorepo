import { BlockList, isIP } from "node:net";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";

export type ClientIpResolver = (context: Context) => string;

function normalizedIp(value: string | undefined): string | null {
  const candidate = value?.trim();
  return candidate && isIP(candidate) !== 0 ? candidate : null;
}

function createTrustedProxyMatcher(cidrs: readonly string[]): (address: string) => boolean {
  const blockList = new BlockList();
  for (const cidr of cidrs) {
    const [address, prefix, ...extra] = cidr.trim().split("/");
    const version = isIP(address ?? "");
    if (!address || version === 0 || extra.length > 0) {
      throw new Error(`Invalid AUTH_TRUSTED_PROXY_CIDRS entry: ${cidr}`);
    }
    const type = version === 4 ? "ipv4" : "ipv6";
    if (prefix === undefined) {
      blockList.addAddress(address, type);
      continue;
    }
    const prefixLength = Number(prefix);
    const maxPrefixLength = version === 4 ? 32 : 128;
    if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > maxPrefixLength) {
      throw new Error(`Invalid AUTH_TRUSTED_PROXY_CIDRS prefix: ${cidr}`);
    }
    blockList.addSubnet(address, prefixLength, type);
  }
  return (address) => {
    const version = isIP(address);
    return version !== 0 && blockList.check(address, version === 4 ? "ipv4" : "ipv6");
  };
}

export function resolveClientIp(input: {
  remoteAddress: string | undefined;
  forwardedFor: string | undefined;
  realIp: string | undefined;
  isTrustedProxy: (address: string) => boolean;
}): string {
  const remoteAddress = normalizedIp(input.remoteAddress);
  if (!remoteAddress) return "unknown";
  if (!input.isTrustedProxy(remoteAddress)) return remoteAddress;

  if (input.forwardedFor) {
    const forwardedChain = input.forwardedFor.split(",").map((value) => normalizedIp(value));
    if (forwardedChain.some((address) => address === null)) return remoteAddress;
    const hops = [...(forwardedChain as string[]), remoteAddress];
    for (let index = hops.length - 1; index >= 0; index -= 1) {
      const hop = hops[index];
      if (hop && !input.isTrustedProxy(hop)) return hop;
    }
    return hops[0] ?? remoteAddress;
  }

  return normalizedIp(input.realIp) ?? remoteAddress;
}

export function createClientIpResolver(trustedProxyCidrs: readonly string[]): ClientIpResolver {
  const isTrustedProxy = createTrustedProxyMatcher(trustedProxyCidrs);
  return (context) => {
    let remoteAddress: string | undefined;
    try {
      remoteAddress = getConnInfo(context).remote.address;
    } catch {
      remoteAddress = undefined;
    }
    return resolveClientIp({
      remoteAddress,
      forwardedFor: context.req.header("x-forwarded-for"),
      realIp: context.req.header("x-real-ip"),
      isTrustedProxy,
    });
  };
}
