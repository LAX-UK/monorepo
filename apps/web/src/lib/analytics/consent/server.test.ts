import { describe, expect, it } from "vitest";
import { readConsentFromCookies } from "./server";

describe("readConsentFromCookies", () => {
  it("returns null when no consent cookie is present", () => {
    const snapshot = readConsentFromCookies({ get: () => undefined });
    expect(snapshot).toBeNull();
  });

  it("parses a stored consent cookie", () => {
    const raw = encodeURIComponent(
      JSON.stringify({
        v: 1,
        ts: "2026-01-01T00:00:00.000Z",
        necessary: true,
        analytics: true,
        marketing: false,
      }),
    );
    const snapshot = readConsentFromCookies({
      get: (name) => (name === "lax_consent" ? { value: raw } : undefined),
    });
    expect(snapshot).toEqual({
      v: 1,
      ts: "2026-01-01T00:00:00.000Z",
      necessary: true,
      analytics: true,
      marketing: false,
    });
  });
});
