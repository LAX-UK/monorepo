import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createOAuthTokenRequestContextMiddleware } from "../middleware/oauth-token-request-context.js";
import {
  ACCESS_TOKEN_TYPE,
  TOKEN_EXCHANGE_GRANT_TYPE,
} from "../services/token-exchange.service.js";
import { createTokenExchangeRoutes } from "./token-exchange.routes.js";

function buildApp(options?: {
  authenticatedClient?: "lax-bid-web" | "lax-shop-web" | "ws-mobile" | null;
}) {
  const exchange = vi.fn().mockResolvedValue({
    access_token: "resource.jwt",
    issued_token_type: ACCESS_TOKEN_TYPE,
    token_type: "Bearer",
    expires_in: 900,
    scope: "bid.read",
  });
  const app = new Hono();
  app.use("/api/auth/oauth2/token", createOAuthTokenRequestContextMiddleware());
  app.route(
    "/api/auth",
    createTokenExchangeRoutes({
      clients: {
        authenticate: vi.fn().mockResolvedValue(options?.authenticatedClient ?? "lax-bid-web"),
      },
      service: { exchange } as never,
    }),
  );
  app.post("/api/auth/oauth2/token", (c) => c.json({ handledBy: "oidc" }));
  return { app, exchange };
}

function exchangeBody(overrides: Record<string, string> = {}) {
  return new URLSearchParams({
    grant_type: TOKEN_EXCHANGE_GRANT_TYPE,
    subject_token: "identity.jwt",
    subject_token_type: ACCESS_TOKEN_TYPE,
    resource: "https://api.lax.bid",
    scope: "bid.read",
    ...overrides,
  });
}

describe("RFC 8693 token exchange route", () => {
  it("authenticates a confidential client and returns the standard response", async () => {
    const { app, exchange } = buildApp();
    const response = await app.request("/api/auth/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from("lax-bid-web:secret").toString("base64")}`,
      },
      body: exchangeBody(),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      access_token: "resource.jwt",
      issued_token_type: ACCESS_TOKEN_TYPE,
      token_type: "Bearer",
      expires_in: 900,
    });
    expect(exchange).toHaveBeenCalledWith({
      clientId: "lax-bid-web",
      subjectToken: "identity.jwt",
      subjectTokenType: ACCESS_TOKEN_TYPE,
      resource: "https://api.lax.bid",
      scope: "bid.read",
    });
  });

  it("rejects unauthenticated and public clients", async () => {
    const missing = buildApp();
    const missingResponse = await missing.app.request("/api/auth/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: exchangeBody(),
    });
    expect(missingResponse.status).toBe(401);
    expect(await missingResponse.json()).toMatchObject({ error: "invalid_client" });

    const publicClient = buildApp({ authenticatedClient: "ws-mobile" });
    const publicResponse = await publicClient.app.request("/api/auth/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from("ws-mobile:secret").toString("base64")}`,
      },
      body: exchangeBody(),
    });
    expect(publicResponse.status).toBe(401);
  });

  it("rejects arbitrary audience and multiple resources", async () => {
    const { app } = buildApp();
    const body = exchangeBody({ audience: "attacker" });
    body.append("resource", "https://ws.lax.bid");
    const response = await app.request("/api/auth/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from("lax-bid-web:secret").toString("base64")}`,
      },
      body,
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_request" });
  });

  it("passes ordinary authorization-code grants through unchanged", async () => {
    const { app, exchange } = buildApp();
    const response = await app.request("/api/auth/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code: "code" }),
    });
    expect(await response.json()).toEqual({ handledBy: "oidc" });
    expect(exchange).not.toHaveBeenCalled();
  });
});
