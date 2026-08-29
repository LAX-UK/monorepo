import { describe, expect, it } from "vitest";
import { bidSessionCookieUsesSecureTransport } from "./session-cookie.server";

describe("bidSessionCookieUsesSecureTransport", () => {
  it("uses secure __Host cookies in production by default", () => {
    expect(bidSessionCookieUsesSecureTransport({ NODE_ENV: "production" })).toBe(true);
  });

  it("allows HTTP localhost e2e when ALLOW_HTTP_COOKIES is true", () => {
    expect(
      bidSessionCookieUsesSecureTransport({
        NODE_ENV: "production",
        ALLOW_HTTP_COOKIES: "true",
      }),
    ).toBe(false);
  });

  it("uses non-secure cookies outside production", () => {
    expect(bidSessionCookieUsesSecureTransport({ NODE_ENV: "development" })).toBe(false);
  });
});
