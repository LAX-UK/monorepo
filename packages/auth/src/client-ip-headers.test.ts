import { describe, expect, it } from "vitest";
import {
  AUTH_IP_ADDRESS_HEADERS,
  TRUSTED_CLIENT_IP_HEADER,
  readTrustedClientIp,
  stampTrustedClientIp,
} from "./client-ip-headers.js";

describe("forwarded client IP headers", () => {
  it("keeps Cloudflare and DigitalOcean precedence consistent", () => {
    expect(AUTH_IP_ADDRESS_HEADERS).toEqual([
      "cf-connecting-ip",
      "do-connecting-ip",
      "x-forwarded-for",
    ]);
  });
});

describe("trusted client address header", () => {
  it("replaces a client-sent value with the resolved address", () => {
    const headers = new Headers({ [TRUSTED_CLIENT_IP_HEADER]: "198.51.100.9" });
    stampTrustedClientIp(headers, "203.0.113.7");
    expect(readTrustedClientIp(headers)).toBe("203.0.113.7");
  });

  it("removes a client-sent value when no address could be resolved", () => {
    for (const resolved of [undefined, "unknown"]) {
      const headers = new Headers({ [TRUSTED_CLIENT_IP_HEADER]: "198.51.100.9" });
      stampTrustedClientIp(headers, resolved);
      expect(readTrustedClientIp(headers)).toBeUndefined();
    }
  });
});
