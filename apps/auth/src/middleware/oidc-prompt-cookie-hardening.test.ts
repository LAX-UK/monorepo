import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createOidcPromptCookieHardeningMiddleware } from "./oidc-prompt-cookie-hardening.js";

describe("createOidcPromptCookieHardeningMiddleware", () => {
  it("adds HttpOnly and Secure to OIDC prompt cookies", async () => {
    const app = new Hono();
    app.use("*", createOidcPromptCookieHardeningMiddleware());
    app.get("/", (c) => {
      c.header("set-cookie", "oidc_login_prompt=abc; Max-Age=600; Path=/; SameSite=Lax");
      return c.text("ok");
    });
    const response = await app.request("http://localhost/");
    const cookies = response.headers.getSetCookie();
    expect(cookies[0]).toMatch(/HttpOnly/i);
    expect(cookies[0]).toMatch(/Secure/i);
  });

  it("leaves unrelated cookies unchanged", async () => {
    const app = new Hono();
    app.use("*", createOidcPromptCookieHardeningMiddleware());
    app.get("/", (c) => {
      c.header("set-cookie", "other=value; Path=/");
      return c.text("ok");
    });
    const response = await app.request("http://localhost/");
    expect(response.headers.getSetCookie()[0]).toBe("other=value; Path=/");
  });
});
