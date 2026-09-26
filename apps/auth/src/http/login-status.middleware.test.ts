import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createLoginStatusMiddleware } from "./login-status.middleware.js";

describe("login-status middleware", () => {
  it("emits Set-Login logged-in when session cookie is set", async () => {
    const app = new Hono();
    app.use("*", createLoginStatusMiddleware());
    app.get("/sign-in", (c) => {
      c.header("set-cookie", "better-auth.session_token=abc; Path=/; HttpOnly");
      return c.text("ok");
    });
    const response = await app.request("/sign-in");
    expect(response.headers.get("Set-Login")).toBe("logged-in");
  });

  it("emits Set-Login when handler returns a Response with set-cookie", async () => {
    const app = new Hono();
    app.use("*", createLoginStatusMiddleware());
    app.get(
      "/auth",
      () =>
        new Response("ok", {
          headers: { "set-cookie": "better-auth.session_token=abc; Path=/; HttpOnly" },
        }),
    );
    const response = await app.request("/auth");
    expect(response.headers.get("Set-Login")).toBe("logged-in");
  });

  it("emits Set-Login logged-out when session cookie is cleared", async () => {
    const app = new Hono();
    app.use("*", createLoginStatusMiddleware());
    app.get("/sign-out", (c) => {
      c.header("set-cookie", "better-auth.session_token=; Max-Age=0; Path=/");
      return c.text("ok");
    });
    const response = await app.request("/sign-out");
    expect(response.headers.get("Set-Login")).toBe("logged-out");
  });
});
