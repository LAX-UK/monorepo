import { describe, expect, it } from "vitest";
import {
  createClientIpPolicy,
  createServerClientIpResolver,
  parseCidrList,
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
