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
        isTrustedProxy: trusted,
      }),
    ).toBe("198.51.100.7");
  });

  it("walks a trusted proxy chain from right to left", () => {
    expect(
      resolveClientIp({
        remoteAddress: "10.0.0.2",
        forwardedFor: "203.0.113.9, 10.0.0.1",
        realIp: undefined,
        isTrustedProxy: trusted,
      }),
    ).toBe("203.0.113.9");
  });

  it("falls back to the trusted peer for malformed forwarding data", () => {
    expect(
      resolveClientIp({
        remoteAddress: "10.0.0.2",
        forwardedFor: "not-an-ip, 10.0.0.1",
        realIp: undefined,
        isTrustedProxy: trusted,
      }),
    ).toBe("10.0.0.2");
  });

  it("rejects invalid trusted proxy CIDRs at startup", () => {
    expect(() => createClientIpResolver(["10.0.0.0/99"])).toThrow(
      "Invalid AUTH_TRUSTED_PROXY_CIDRS prefix",
    );
  });
});
