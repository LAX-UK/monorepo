import { describe, expect, it } from "vitest";
import { accountCookiePolicy } from "./session-cookie";

describe("accountCookiePolicy", () => {
  it("uses a Secure __Host- cookie on HTTPS origins", () => {
    expect(accountCookiePolicy("https://test-account.lax.bid")).toEqual({
      secure: true,
      sessionCookie: "__Host-lax-account-session",
    });
  });

  it("drops the __Host- prefix on plain-HTTP local origins", () => {
    expect(accountCookiePolicy("http://localhost:3040")).toEqual({
      secure: false,
      sessionCookie: "lax-account-session",
    });
  });
});
