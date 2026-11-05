import { describe, expect, it } from "vitest";
import { AUTH_IP_ADDRESS_HEADERS } from "./client-ip-headers.js";

describe("forwarded client IP headers", () => {
  it("keeps Cloudflare and DigitalOcean precedence consistent", () => {
    expect(AUTH_IP_ADDRESS_HEADERS).toEqual([
      "cf-connecting-ip",
      "do-connecting-ip",
      "x-forwarded-for",
    ]);
  });
});
