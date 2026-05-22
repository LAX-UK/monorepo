import { afterEach, describe, expect, it, vi } from "vitest";
import { readEffectiveConsentFromCookies } from "./server";

describe("readEffectiveConsentFromCookies", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when no consent cookie and banner toggle is off", () => {
    vi.stubEnv("NEXT_PUBLIC_DISABLE_CONSENT_BANNER", "false");
    const snapshot = readEffectiveConsentFromCookies({ get: () => undefined });
    expect(snapshot).toBeNull();
  });

  it("synthesises an all-granted snapshot when banner toggle is on", () => {
    vi.stubEnv("NEXT_PUBLIC_DISABLE_CONSENT_BANNER", "true");
    const snapshot = readEffectiveConsentFromCookies({ get: () => undefined });
    expect(snapshot).toEqual({
      v: 1,
      ts: expect.any(String),
      necessary: true,
      analytics: true,
      marketing: true,
    });
  });

  it("prefers the disable-banner toggle over an existing cookie", () => {
    vi.stubEnv("NEXT_PUBLIC_DISABLE_CONSENT_BANNER", "true");
    const rejected = encodeURIComponent(
      JSON.stringify({
        v: 1,
        ts: "2026-01-01T00:00:00.000Z",
        necessary: true,
        analytics: false,
        marketing: false,
      }),
    );
    const snapshot = readEffectiveConsentFromCookies({
      get: (name) => (name === "lax_consent" ? { value: rejected } : undefined),
    });
    expect(snapshot?.analytics).toBe(true);
    expect(snapshot?.marketing).toBe(true);
  });
});
