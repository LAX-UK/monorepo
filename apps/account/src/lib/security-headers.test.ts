import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { securityHeaders } from "./security-headers";

const value = (headers: ReturnType<typeof securityHeaders>, key: string) =>
  headers.find((header) => header.key === key)?.value;

describe("securityHeaders", () => {
  const production = securityHeaders({ development: false });

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
    const dev = value(securityHeaders({ development: true }), "Content-Security-Policy") ?? "";
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("ws:");
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
