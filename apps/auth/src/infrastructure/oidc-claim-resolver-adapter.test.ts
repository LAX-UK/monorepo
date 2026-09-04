import { APIError } from "better-auth/api";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { OidcAuthorizationCodeCorrelationError } from "../services/oidc-session-coordinator.js";
import { adaptOidcClaimsResolver } from "./oidc-claim-resolver-adapter.js";

describe("OIDC claims resolver adapter", () => {
  it("returns OAuth invalid_grant HTTP semantics for a missing or consumed correlation", async () => {
    const resolve = adaptOidcClaimsResolver(async () => {
      throw new OidcAuthorizationCodeCorrelationError();
    });
    const app = new Hono();
    app.onError((error, c) => {
      if (error instanceof APIError) {
        return c.json(error.body, error.statusCode as 400);
      }
      return c.json({ error: "server_error" }, 500);
    });
    app.post("/oauth2/token", async (c) => c.json(await resolve(await c.req.json())));

    const response = await app.request("/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subjectId: "subject-1", clientId: "lax-bid-web" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_grant",
      error_description: "Authorization code is invalid or has already been consumed",
    });
  });

  it("does not disguise unrelated failures as invalid_grant", async () => {
    const resolve = adaptOidcClaimsResolver(async () => {
      throw new Error("database unavailable");
    });

    await expect(resolve({ subjectId: "subject-1", clientId: "lax-bid-web" })).rejects.toThrow(
      "database unavailable",
    );
  });
});
