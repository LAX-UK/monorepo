import { describe, expect, it, vi } from "vitest";
import { createOauthTokenManagementRoutes } from "./oauth-token-management.routes.js";

function basic(clientId: string, secret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`;
}

describe("OAuth token management routes", () => {
  it("returns 200 for an unknown revocation token without leaking state", async () => {
    const revoke = vi.fn().mockResolvedValue({ subjectId: null, refreshRevoked: false });
    const app = createOauthTokenManagementRoutes({
      clients: { authenticate: async () => "lax-shop-web" },
      tokens: { revoke } as never,
      logout: { revokeSubject: vi.fn() } as never,
    });
    const response = await app.request("/oauth2/revoke", {
      method: "POST",
      headers: {
        Authorization: basic("lax-shop-web", "secret"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "token=unknown",
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(revoke).toHaveBeenCalledWith({
      requesterClientId: "lax-shop-web",
      token: "unknown",
      tokenTypeHint: undefined,
    });
  });

  it("returns only active false for a token unavailable to the requesting client", async () => {
    const introspect = vi.fn().mockResolvedValue({ active: false });
    const app = createOauthTokenManagementRoutes({
      clients: { authenticate: async () => "lax-bid-web" },
      tokens: { introspect } as never,
      logout: {} as never,
    });
    const response = await app.request("/oauth2/introspect", {
      method: "POST",
      headers: {
        Authorization: basic("lax-bid-web", "secret"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "token=shop-token",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ active: false });
    expect(introspect).toHaveBeenCalledWith({
      requesterClientId: "lax-bid-web",
      token: "shop-token",
      tokenTypeHint: undefined,
    });
  });
});
