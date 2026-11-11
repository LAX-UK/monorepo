import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createSecurityHeadersMiddleware } from "./security-headers.js";

describe("auth issuer security headers", () => {
  it("sets baseline headers and HTTPS HSTS", async () => {
    const app = new Hono();
    app.use("*", createSecurityHeadersMiddleware());
    app.get("/health/live", (c) => c.json({ status: "ok" }));
    const response = await app.request("https://auth.example.com/health/live");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("content-security-policy")).not.toContain("style-src");
    expect(response.headers.get("strict-transport-security")).toContain("max-age=31536000");
  });

  it("sets the default referrer policy, but keeps one a route already set", async () => {
    const app = new Hono();
    app.use("*", createSecurityHeadersMiddleware());
    app.get("/plain", (c) => c.text("x"));
    app.get("/one-time", (c) => {
      c.header("Referrer-Policy", "no-referrer");
      return c.text("x");
    });
    expect((await app.request("/plain")).headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect((await app.request("/one-time")).headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("allows hosted HTML to load the stylesheet, fonts, and logo", async () => {
    const app = new Hono();
    app.use("*", createSecurityHeadersMiddleware());
    app.get("/login", (c) => c.html("<html><body>Sign in</body></html>"));
    const response = await app.request("https://auth.example.com/login");
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("style-src 'self'");
    expect(csp).not.toContain("googleapis");
    expect(csp).not.toContain("gstatic");
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/);
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("img-src 'self'");
    expect(csp).not.toContain("unsafe-inline");
  });

  it("widens hosted HTML CSP only when Turnstile is enabled", async () => {
    const app = new Hono();
    app.use("*", createSecurityHeadersMiddleware({ turnstileEnabled: true }));
    app.get("/login", (c) => c.html("<html><body>Sign in</body></html>"));
    const response = await app.request("https://auth.example.com/login");
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toContain("frame-src https://challenges.cloudflare.com");
  });

  it("keeps document-less CSP on stylesheets", async () => {
    const app = new Hono();
    app.use("*", createSecurityHeadersMiddleware());
    app.get("/hosted-auth.css", (c) =>
      c.body("body{}", 200, { "Content-Type": "text/css; charset=utf-8" }),
    );
    const response = await app.request("https://auth.example.com/hosted-auth.css");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("content-security-policy")).not.toContain("style-src");
  });

  it("does not emit HSTS over local HTTP", async () => {
    const app = new Hono();
    app.use("*", createSecurityHeadersMiddleware());
    app.get("/health/live", (c) => c.json({ status: "ok" }));
    const response = await app.request("http://localhost/health/live");
    expect(response.headers.get("strict-transport-security")).toBeNull();
  });

  it("lets hosted pages make and use passkeys for themselves only, and keeps the API closed", async () => {
    const app = new Hono();
    app.use("*", createSecurityHeadersMiddleware());
    app.get("/login", (c) => c.html("<html><body>Sign in</body></html>"));
    app.get("/api/thing", (c) => c.json({ ok: true }));
    const page = await app.request("https://auth.example.com/login");
    const policy = page.headers.get("permissions-policy") ?? "";
    expect(policy).toContain("publickey-credentials-create=(self)");
    expect(policy).toContain("publickey-credentials-get=(self)");
    expect(policy).toContain("camera=()");
    expect(page.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    const api = await app.request("https://auth.example.com/api/thing");
    expect(api.headers.get("permissions-policy")).not.toContain("publickey-credentials");
  });
});
