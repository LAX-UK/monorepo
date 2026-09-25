import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createAuthRouteCorsMiddleware } from "./auth-route-cors.js";

describe("createAuthRouteCorsMiddleware", () => {
  const app = new Hono();
  app.use("*", createAuthRouteCorsMiddleware(["https://lax.bid"]));
  app.post("/api/auth/sign-in/email", (c) => c.text("login"));
  app.post("/api/auth/two-factor/verify-totp", (c) => c.text("2fa"));

  it("allows Bid origin on account-management credential routes", async () => {
    const res = await app.request("https://auth.lax.bid/api/auth/two-factor/verify-totp", {
      method: "OPTIONS",
      headers: {
        Origin: "https://lax.bid",
        "Access-Control-Request-Method": "POST",
      },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://lax.bid");
  });

  it("does not allow Bid origin on primary login credential routes", async () => {
    const res = await app.request("https://auth.lax.bid/api/auth/sign-in/email", {
      method: "OPTIONS",
      headers: {
        Origin: "https://lax.bid",
        "Access-Control-Request-Method": "POST",
      },
    });
    const allowOrigin = res.headers.get("access-control-allow-origin");
    expect(allowOrigin === null || allowOrigin === "").toBe(true);
  });
});
