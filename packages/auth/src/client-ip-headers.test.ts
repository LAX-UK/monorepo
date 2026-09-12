import { describe, expect, it } from "vitest";
import { AUTH_IP_ADDRESS_HEADERS, readForwardedClientIp } from "./client-ip-headers.js";

describe("forwarded client IP headers", () => {
  it("keeps Cloudflare and DigitalOcean precedence consistent", () => {
    expect(AUTH_IP_ADDRESS_HEADERS).toEqual([
      "cf-connecting-ip",
      "do-connecting-ip",
      "x-forwarded-for",
    ]);
    const headers = new Map([
      ["cf-connecting-ip", "203.0.113.9"],
      ["do-connecting-ip", "173.245.48.10"],
      ["x-forwarded-for", "10.0.0.1"],
    ]);
    expect(readForwardedClientIp((name) => headers.get(name))).toBe("203.0.113.9");
  });

  it("uses the first X-Forwarded-For hop as a compatibility fallback", () => {
    expect(
      readForwardedClientIp((name) =>
        name === "x-forwarded-for" ? "203.0.113.9, 10.0.0.1" : undefined,
      ),
    ).toBe("203.0.113.9");
  });
});
