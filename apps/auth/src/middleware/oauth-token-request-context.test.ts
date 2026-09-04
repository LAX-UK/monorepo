import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  createOAuthTokenRequestContextMiddleware,
  getOAuthTokenRequestContext,
} from "./oauth-token-request-context.js";

describe("OAuth token request context", () => {
  it("parses form data once and leaves the rebuilt request body unread", async () => {
    const app = new Hono();
    app.use("/api/auth/oauth2/token", createOAuthTokenRequestContextMiddleware());
    app.post("/api/auth/oauth2/token", async (c) => {
      const parsed = getOAuthTokenRequestContext(c);
      return c.json({
        grantType: parsed?.grantType,
        code: parsed?.authorizationCode,
        unreadBody: await c.req.raw.text(),
      });
    });

    const body = "grant_type=authorization_code&code=secret-code";
    const response = await app.request("/api/auth/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });

    await expect(response.json()).resolves.toEqual({
      grantType: "authorization_code",
      code: "secret-code",
      unreadBody: body,
    });
  });
});
