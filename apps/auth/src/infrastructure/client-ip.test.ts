import { describe, expect, it } from "vitest";
import { createClientIpResolver, resolveClientIp } from "./client-ip.js";

const trusted = (address: string) => address.startsWith("10.");

describe("auth client IP resolution", () => {
  it("ignores spoofable forwarding headers from untrusted peers", () => {
    expect(
      resolveClientIp({
        remoteAddress: "198.51.100.7",
        forwardedFor: "203.0.113.9",
        realIp: "203.0.113.10",
        cfConnectingIp: "203.0.113.11",
        doConnectingIp: "203.0.113.12",
        isTrustedProxy: trusted,
        isTrustedCloudflareProxy: () => true,
      }),
    ).toBe("198.51.100.7");
  });

  it("walks a trusted proxy chain from right to left", () => {
    expect(
      resolveClientIp({
        remoteAddress: "10.0.0.2",
        forwardedFor: "203.0.113.9, 10.0.0.1",
        realIp: undefined,
        cfConnectingIp: undefined,
        doConnectingIp: undefined,
        isTrustedProxy: trusted,
        isTrustedCloudflareProxy: () => false,
      }),
    ).toBe("203.0.113.9");
  });

  it("falls back to the trusted peer for malformed forwarding data", () => {
    expect(
      resolveClientIp({
        remoteAddress: "10.0.0.2",
        forwardedFor: "not-an-ip, 10.0.0.1",
        realIp: undefined,
        cfConnectingIp: undefined,
        doConnectingIp: undefined,
        isTrustedProxy: trusted,
        isTrustedCloudflareProxy: () => false,
      }),
    ).toBe("10.0.0.2");
  });

  it("rejects invalid trusted proxy CIDRs at startup", () => {
    expect(() => createClientIpResolver(["10.0.0.0/99"])).toThrow(
      "Invalid AUTH_TRUSTED_PROXY_CIDRS prefix",
    );
  });

  it("uses Cloudflare's client IP only when DigitalOcean identifies a trusted Cloudflare hop", () => {
    expect(
      resolveClientIp({
        remoteAddress: "10.0.0.2",
        forwardedFor: "10.0.0.1",
        realIp: undefined,
        cfConnectingIp: "203.0.113.9",
        doConnectingIp: "173.245.48.10",
        isTrustedProxy: trusted,
        isTrustedCloudflareProxy: (address) => address.startsWith("173.245."),
      }),
    ).toBe("203.0.113.9");
  });

  it("falls back to DigitalOcean's authenticated client hop when Cloudflare is not trusted", () => {
    expect(
      resolveClientIp({
        remoteAddress: "10.0.0.2",
        forwardedFor: "10.0.0.1",
        realIp: undefined,
        cfConnectingIp: "198.51.100.99",
        doConnectingIp: "198.51.100.7",
        isTrustedProxy: trusted,
        isTrustedCloudflareProxy: () => false,
      }),
    ).toBe("198.51.100.7");
  });

  it("ignores malformed DigitalOcean and Cloudflare headers", () => {
    expect(
      resolveClientIp({
        remoteAddress: "10.0.0.2",
        forwardedFor: "203.0.113.9, 10.0.0.1",
        realIp: undefined,
        cfConnectingIp: "not-an-ip",
        doConnectingIp: "also-not-an-ip",
        isTrustedProxy: trusted,
        isTrustedCloudflareProxy: () => true,
      }),
    ).toBe("203.0.113.9");
  });
});
