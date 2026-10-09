import { describe, expect, it } from "vitest";
import { assertMutationCsrf } from "./csrf-policy";

const origin = "https://test-shop-admin.lax.bid";

describe("assertMutationCsrf", () => {
  it("allows safe methods without csrf", () => {
    expect(() =>
      assertMutationCsrf({
        method: "GET",
        origin: null,
        expectedOrigin: origin,
        csrfHeader: null,
        csrfCookie: null,
      }),
    ).not.toThrow();
  });

  it("allows server actions with origin only", () => {
    expect(() =>
      assertMutationCsrf({
        method: "POST",
        origin: "https://admin.example.com",
        expectedOrigin: "https://admin.example.com",
        csrfHeader: null,
        csrfCookie: "abc",
        fromServerAction: true,
      }),
    ).not.toThrow();
  });

  it("requires matching origin and csrf for POST", () => {
    expect(() =>
      assertMutationCsrf({
        method: "POST",
        origin,
        expectedOrigin: origin,
        csrfHeader: "abc",
        csrfCookie: "abc",
      }),
    ).not.toThrow();
    expect(() =>
      assertMutationCsrf({
        method: "POST",
        origin: "https://evil.example",
        expectedOrigin: origin,
        csrfHeader: "abc",
        csrfCookie: "abc",
      }),
    ).toThrow(/Cross-origin/);
    expect(() =>
      assertMutationCsrf({
        method: "POST",
        origin,
        expectedOrigin: origin,
        csrfHeader: "abc",
        csrfCookie: "def",
      }),
    ).toThrow(/CSRF/);
  });
});
