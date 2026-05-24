import { describe, expect, it } from "vitest";
import {
  canonicalizeXeroCallbackUrl,
  isXeroCallbackUrlAllowed,
  normalizeXeroCallbackUrl,
} from "./xero.js";

describe("isXeroCallbackUrlAllowed", () => {
  const allowed = "http://localhost:3000/admin/integrations/xero/callback";

  it("accepts exact redirect URI match", () => {
    expect(
      isXeroCallbackUrlAllowed(
        "http://localhost:3000/admin/integrations/xero/callback?code=abc&state=xyz",
        allowed,
      ),
    ).toBe(true);
  });

  it("accepts loopback host aliases with the same path", () => {
    expect(
      isXeroCallbackUrlAllowed(
        "http://0.0.0.0:3000/admin/integrations/xero/callback?code=abc&state=xyz",
        allowed,
      ),
    ).toBe(true);
    expect(
      isXeroCallbackUrlAllowed(
        "http://127.0.0.1:3000/admin/integrations/xero/callback?code=abc&state=xyz",
        allowed,
      ),
    ).toBe(true);
  });

  it("rejects mismatched path", () => {
    expect(
      isXeroCallbackUrlAllowed("http://localhost:3000/admin/integrations/xero?error=1", allowed),
    ).toBe(false);
  });

  it("rejects unrelated origins", () => {
    expect(
      isXeroCallbackUrlAllowed(
        "https://evil.example/admin/integrations/xero/callback?code=abc",
        allowed,
      ),
    ).toBe(false);
  });
});

describe("normalizeXeroCallbackUrl", () => {
  it("rewrites loopback origin to canonical site URL", () => {
    expect(
      normalizeXeroCallbackUrl(
        "https://0.0.0.0:3000/admin/integrations/xero/callback?code=abc&state=xyz",
        "http://localhost:3000",
      ),
    ).toBe("http://localhost:3000/admin/integrations/xero/callback?code=abc&state=xyz");
  });
});

describe("canonicalizeXeroCallbackUrl", () => {
  const allowed = "https://test.lax.bid/admin/integrations/xero/callback";

  it("rewrites proxy internal host to configured redirect URI", () => {
    expect(
      canonicalizeXeroCallbackUrl(
        "https://0.0.0.0:8080/admin/integrations/xero/callback?code=abc&state=xyz",
        allowed,
      ),
    ).toBe("https://test.lax.bid/admin/integrations/xero/callback?code=abc&state=xyz");
  });

  it("rejects mismatched callback path", () => {
    expect(
      canonicalizeXeroCallbackUrl("https://test.lax.bid/admin/integrations/xero?error=1", allowed),
    ).toBeNull();
  });
});
