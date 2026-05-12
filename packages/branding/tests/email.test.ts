import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("email branding URLs", () => {
  const originalAssets = process.env.EMAIL_ASSETS_BASE_URL;
  const originalPublic = process.env.NEXT_PUBLIC_SITE_URL;
  const originalWebOrigin = process.env.WEB_ORIGIN;

  beforeEach(() => {
    vi.resetModules();
    // process.env values must be actually unset (not "undefined" string) so the
    // module-level fallback chain in `email.ts` behaves as intended.
    Reflect.deleteProperty(process.env, "EMAIL_ASSETS_BASE_URL");
    Reflect.deleteProperty(process.env, "NEXT_PUBLIC_SITE_URL");
    Reflect.deleteProperty(process.env, "WEB_ORIGIN");
  });

  afterEach(() => {
    if (originalAssets === undefined) {
      Reflect.deleteProperty(process.env, "EMAIL_ASSETS_BASE_URL");
    } else {
      process.env.EMAIL_ASSETS_BASE_URL = originalAssets;
    }
    if (originalPublic === undefined) {
      Reflect.deleteProperty(process.env, "NEXT_PUBLIC_SITE_URL");
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalPublic;
    }
    if (originalWebOrigin === undefined) {
      Reflect.deleteProperty(process.env, "WEB_ORIGIN");
    } else {
      process.env.WEB_ORIGIN = originalWebOrigin;
    }
  });

  it("falls back to localhost when no branding env is set", async () => {
    const { EMAIL_SITE_URL, EMAIL_LOGO_URL, EMAIL_LOGO_URL_2X } = await import("../src/email.js");
    expect(EMAIL_SITE_URL).toBe("http://localhost:3000");
    expect(EMAIL_LOGO_URL).toBe("http://localhost:3000/email/lax-logo.png");
    expect(EMAIL_LOGO_URL_2X).toBe("http://localhost:3000/email/lax-logo@2x.png");
  });

  it("uses WEB_ORIGIN when asset and public site URL are unset", async () => {
    process.env.WEB_ORIGIN = "https://test-app.example/";
    const { EMAIL_SITE_URL, EMAIL_LOGO_URL } = await import("../src/email.js");
    expect(EMAIL_SITE_URL).toBe("https://test-app.example");
    expect(EMAIL_LOGO_URL).toBe("https://test-app.example/email/lax-logo.png");
  });

  it("prefers EMAIL_ASSETS_BASE_URL over NEXT_PUBLIC_SITE_URL", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://wrong.example";
    process.env.EMAIL_ASSETS_BASE_URL = "https://cdn.example/";
    const { EMAIL_SITE_URL, EMAIL_LOGO_URL } = await import("../src/email.js");
    expect(EMAIL_SITE_URL).toBe("https://cdn.example");
    expect(EMAIL_LOGO_URL).toBe("https://cdn.example/email/lax-logo.png");
  });
});
