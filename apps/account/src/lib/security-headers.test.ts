import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { securityHeaders } from "./security-headers";

const value = (headers: ReturnType<typeof securityHeaders>, key: string) =>
  headers.find((header) => header.key === key)?.value;

const IMAGES = ["https://cdn.lax.bid"];

describe("securityHeaders", () => {
  const production = securityHeaders({ development: false, imageOrigins: IMAGES });

  it("forbids framing and restricts the page to its own origin", () => {
    const csp = value(production, "Content-Security-Policy") ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("allows no eval or WebSocket outside development", () => {
    const csp = value(production, "Content-Security-Policy") ?? "";
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("ws:");
    const dev =
      value(
        securityHeaders({ development: true, imageOrigins: IMAGES }),
        "Content-Security-Policy",
      ) ?? "";
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("ws:");
  });

  it("allows images only from the configured media origins, never a blanket https:", () => {
    const csp = value(production, "Content-Security-Policy") ?? "";
    expect(csp).toContain("img-src 'self' data: https://cdn.lax.bid;");
    expect(csp).not.toMatch(/img-src[^;]* https:(;|\s)/);
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  });

  it("sets the referrer, permissions and sniffing policies", () => {
    expect(value(production, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(value(production, "Permissions-Policy")).toContain("camera=()");
    expect(value(production, "X-Content-Type-Options")).toBe("nosniff");
  });
});

describe("next.config headers", () => {
  it("applies the security headers to every route", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const all = rules.find((rule) => rule.source === "/:path*");
    const keys = all?.headers.map((header) => header.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "Referrer-Policy",
        "Permissions-Policy",
        "X-Content-Type-Options",
      ]),
    );
  });
});
