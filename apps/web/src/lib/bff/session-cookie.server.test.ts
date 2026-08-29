import { describe, expect, it } from "vitest";
import {
  bidSessionCookieUsesSecureTransport,
  getBidSessionCookieName,
  parseBidSessionId,
  readBidSessionIdFromStore,
} from "./session-cookie.server";

const validSessionId = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklm0123";
const legacySessionId = "1111111111111111111111111111111111111111111";

describe("parseBidSessionId", () => {
  it("accepts base64url session ids", () => {
    expect(parseBidSessionId(validSessionId)).toBe(validSessionId);
  });

  it("rejects malformed ids", () => {
    expect(parseBidSessionId("too-short")).toBeNull();
    expect(parseBidSessionId(null)).toBeNull();
  });
});

describe("readBidSessionIdFromStore", () => {
  it("reads either registered cookie name", () => {
    const store = {
      get: (name: string) =>
        name === "__Host-lax-bid-session" ? { value: validSessionId } : undefined,
    };
    expect(readBidSessionIdFromStore(store, { NODE_ENV: "production" })).toBe(validSessionId);
  });

  it("prefers the canonical cookie name when both legacy names are present", () => {
    const store = {
      get: (name: string) => {
        if (name === "lax-bid-session") return { value: legacySessionId };
        if (name === "__Host-lax-bid-session") return { value: validSessionId };
        return undefined;
      },
    };
    expect(readBidSessionIdFromStore(store, { NODE_ENV: "production" })).toBe(validSessionId);
    expect(
      readBidSessionIdFromStore(store, { NODE_ENV: "production", ALLOW_HTTP_COOKIES: "true" }),
    ).toBe(legacySessionId);
  });
});

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

describe("getBidSessionCookieName", () => {
  it("resolves the cookie name from runtime env", () => {
    expect(
      getBidSessionCookieName({
        NODE_ENV: "production",
        ALLOW_HTTP_COOKIES: "true",
      }),
    ).toBe("lax-bid-session");
    expect(getBidSessionCookieName({ NODE_ENV: "production" })).toBe("__Host-lax-bid-session");
  });
});
