import { describe, expect, it } from "vitest";
import {
  createClientIpPolicy,
  createServerClientIpResolver,
  parseCidrList,
  parseTrustedProxyHops,
  resolveClientIpFromHeaders,
  serverClientIpHeaders,
} from "./client-ip.js";

const policy = createClientIpPolicy();

function resolve(
  peer: string | undefined,
  headers: Record<string, string>,
  options: { peerBehindTrustedProxy?: boolean } = {},
) {
  return resolveClientIpFromHeaders((name) => headers[name], policy, {
    remoteAddress: peer,
    ...options,
  });
}

describe("resolveClientIp", () => {
  it("ignores every forwarded header from an untrusted peer", () => {
    expect(
      resolve("198.51.100.7", {
        "x-forwarded-for": "203.0.113.9",
        "x-real-ip": "203.0.113.10",
        "cf-connecting-ip": "203.0.113.11",
        "do-connecting-ip": "203.0.113.12",
      }),
    ).toBe("198.51.100.7");
  });

  it("is unknown when the peer cannot be read", () => {
    expect(resolve(undefined, { "x-forwarded-for": "203.0.113.9" })).toBe("unknown");
  });

  it("walks a trusted chain from the right, so a spoofed first entry is ignored", () => {
    expect(resolve("10.0.0.2", { "x-forwarded-for": "1.2.3.4, 203.0.113.9, 10.0.0.1" })).toBe(
      "203.0.113.9",
    );
  });

  it("does not believe a malformed chain", () => {
    expect(resolve("10.0.0.2", { "x-forwarded-for": "not-an-ip, 203.0.113.9" })).toBe("10.0.0.2");
  });

  it("prefers the Cloudflare address when the DigitalOcean hop is a Cloudflare edge", () => {
    expect(
      resolve("10.0.0.2", {
        "do-connecting-ip": "173.245.48.10",
        "cf-connecting-ip": "203.0.113.9",
        "x-forwarded-for": "1.2.3.4",
      }),
    ).toBe("203.0.113.9");
  });

  it("ignores cf-connecting-ip when the DigitalOcean hop is not Cloudflare", () => {
    expect(
      resolve("10.0.0.2", {
        "do-connecting-ip": "198.51.100.20",
        "cf-connecting-ip": "203.0.113.9",
      }),
    ).toBe("198.51.100.20");
  });

  it("skips Cloudflare edges when walking the chain", () => {
    expect(resolve("10.0.0.2", { "x-forwarded-for": "1.2.3.4, 203.0.113.9, 173.245.48.10" })).toBe(
      "203.0.113.9",
    );
  });

  it("handles IPv6 clients and proxies", () => {
    const v6 = createClientIpPolicy({ trustedProxyCidrs: ["fd00::/8"] });
    expect(
      resolveClientIpFromHeaders(
        (name) => ({ "x-forwarded-for": "2001:db8::1, fd00::5" })[name],
        v6,
        { remoteAddress: "fd00::2" },
      ),
    ).toBe("2001:db8::1");
    expect(
      resolveClientIpFromHeaders((name) => ({ "x-forwarded-for": "9.9.9.9" })[name], v6, {
        remoteAddress: "2001:db8::77",
      }),
    ).toBe("2001:db8::77");
  });

  it("falls back to x-real-ip, then the peer", () => {
    expect(resolve("10.0.0.2", { "x-real-ip": "203.0.113.5" })).toBe("203.0.113.5");
    expect(resolve("10.0.0.2", {})).toBe("10.0.0.2");
  });

  it("without a readable peer, trusts the ingress only when told to", () => {
    const headers = { "x-forwarded-for": "1.2.3.4, 203.0.113.9, 173.245.48.10" };
    expect(resolve(undefined, headers, { peerBehindTrustedProxy: true })).toBe("203.0.113.9");
    expect(resolve(undefined, {}, { peerBehindTrustedProxy: true })).toBe("unknown");
  });

  it("rejects a malformed CIDR", () => {
    expect(() => createClientIpPolicy({ trustedProxyCidrs: ["10.0.0.0/99"] })).toThrow(
      "Invalid trusted proxy CIDRs prefix",
    );
  });
});

describe("forged headers", () => {
  const real = "203.0.113.9";

  it("keeps the key when a caller prepends its own leftmost x-forwarded-for entry", () => {
    const keys = ["1.1.1.1", "2.2.2.2", "8.8.4.4", "10.9.9.9"].map((forged) =>
      resolve("10.0.0.2", { "x-forwarded-for": `${forged}, ${real}` }),
    );
    expect(new Set(keys)).toEqual(new Set([real]));
  });

  it("never returns a forged leftmost entry when every hop is a trusted proxy", () => {
    expect(resolve("10.0.0.2", { "x-forwarded-for": "10.1.2.3, 10.0.0.1" })).toBe("10.0.0.2");
  });

  it("ignores x-forwarded-for entirely from an untrusted peer", () => {
    expect(resolve("198.51.100.7", { "x-forwarded-for": "1.1.1.1" })).toBe("198.51.100.7");
  });

  it("uses cf-connecting-ip when the request came through Cloudflare", () => {
    expect(
      resolve("10.0.0.2", {
        "do-connecting-ip": "172.64.1.1",
        "cf-connecting-ip": real,
        "x-forwarded-for": "1.1.1.1",
      }),
    ).toBe(real);
  });

  it("ignores cf-connecting-ip that did not come through Cloudflare", () => {
    expect(resolve("10.0.0.2", { "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": real })).toBe(
      real,
    );
  });

  it("falls back to the socket address when no header is present", () => {
    expect(resolve("198.51.100.7", {})).toBe("198.51.100.7");
    expect(resolve("10.0.0.2", {})).toBe("10.0.0.2");
  });
});

describe("multi-hop chains", () => {
  const read = (xff: string) => (name: string) => ({ "x-forwarded-for": xff })[name];

  it("takes the right-most untrusted entry across several known proxies", () => {
    expect(
      resolveClientIpFromHeaders(read("9.9.9.9, 203.0.113.9, 10.0.0.5, 10.0.0.6"), policy, {
        remoteAddress: "10.0.0.2",
      }),
    ).toBe("203.0.113.9");
  });

  it("skips extra operated hops outside the CIDR lists when configured", () => {
    const twoHops = createClientIpPolicy({ trustedProxyHops: 2 });
    expect(
      resolveClientIpFromHeaders(read("9.9.9.9, 203.0.113.9, 198.51.100.50"), twoHops, {
        remoteAddress: "10.0.0.2",
      }),
    ).toBe("203.0.113.9");
    // The default of one hop treats that outer entry as the client.
    expect(
      resolveClientIpFromHeaders(read("9.9.9.9, 203.0.113.9, 198.51.100.50"), policy, {
        remoteAddress: "10.0.0.2",
      }),
    ).toBe("198.51.100.50");
  });

  it("never reaches the leftmost entry through a larger hop count", () => {
    const many = createClientIpPolicy({ trustedProxyHops: 5 });
    expect(
      resolveClientIpFromHeaders(read("1.1.1.1, 198.51.100.50"), many, {
        remoteAddress: "10.0.0.2",
      }),
    ).toBe("10.0.0.2");
  });

  it("parses the hop-count setting with a safe default", () => {
    expect(parseTrustedProxyHops(undefined)).toBe(1);
    expect(parseTrustedProxyHops("2")).toBe(2);
    expect(parseTrustedProxyHops("0")).toBe(1);
    expect(parseTrustedProxyHops("abc")).toBe(1);
    expect(parseTrustedProxyHops("99")).toBe(1);
  });
});

describe("server helpers", () => {
  it("resolves Next.js request headers", () => {
    const resolveHeaders = createServerClientIpResolver();
    const headers = new Headers({
      "do-connecting-ip": "162.158.1.1",
      "cf-connecting-ip": "203.0.113.9",
      "x-forwarded-for": "1.2.3.4",
    });
    expect(resolveHeaders(headers)).toBe("203.0.113.9");
  });

  it("parses CIDR lists with a fallback", () => {
    expect(parseCidrList(" 10.0.0.0/8 , 192.168.0.0/16", [])).toEqual([
      "10.0.0.0/8",
      "192.168.0.0/16",
    ]);
    expect(parseCidrList("", ["10.0.0.0/8"])).toEqual(["10.0.0.0/8"]);
  });

  it("sends the visitor address only with a token and a valid address", () => {
    expect(serverClientIpHeaders("203.0.113.9", "tok")).toEqual({
      "x-lax-client-ip": "203.0.113.9",
      "x-lax-client-ip-token": "tok",
    });
    expect(serverClientIpHeaders("203.0.113.9", undefined)).toEqual({});
    expect(serverClientIpHeaders("unknown", "tok")).toEqual({});
  });
});
