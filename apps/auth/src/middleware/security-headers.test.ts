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
    expect(response.headers.get("strict-transport-security")).toContain("max-age=31536000");
  });

  it("does not emit HSTS over local HTTP", async () => {
    const app = new Hono();
    app.use("*", createSecurityHeadersMiddleware());
    app.get("/health/live", (c) => c.json({ status: "ok" }));
    const response = await app.request("http://localhost/health/live");
    expect(response.headers.get("strict-transport-security")).toBeNull();
  });
});
