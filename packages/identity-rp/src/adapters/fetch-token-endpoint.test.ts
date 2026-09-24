import { describe, expect, it } from "vitest";
import { IdentityRejectedError, IdentityUnavailableError } from "../errors.js";
import { createFetchTokenEndpoint } from "./fetch-token-endpoint.js";

const tokenUrl = "https://auth.example/token";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createFetchTokenEndpoint", () => {
  it("uses basic auth and returns parsed bearer tokens", async () => {
    const calls: { headers: Record<string, string>; body: string }[] = [];
    const endpoint = createFetchTokenEndpoint({
      tokenEndpointUrl: tokenUrl,
      auth: { kind: "basic", clientId: "bid-web", clientSecret: "secret" },
      timeoutMs: 5_000,
      fetchImpl: async (_url, init) => {
        calls.push({
          headers: init?.headers as Record<string, string>,
          body: String(init?.body ?? ""),
        });
        return jsonResponse({
          access_token: "access",
          token_type: "Bearer",
          expires_in: 3600,
        });
      },
    });

    const token = await endpoint.requestToken(new URLSearchParams({ grant_type: "refresh_token" }));
    expect(token.access_token).toBe("access");
    expect(calls[0]?.headers.authorization).toMatch(/^Basic /);
    expect(new URLSearchParams(calls[0]?.body ?? "").has("client_id")).toBe(false);
  });

  it("sends client credentials in the body for body auth", async () => {
    let body = "";
    const endpoint = createFetchTokenEndpoint({
      tokenEndpointUrl: tokenUrl,
      auth: { kind: "body", clientId: "shop-web", clientSecret: "secret" },
      timeoutMs: 5_000,
      fetchImpl: async (_url, init) => {
        body = String(init?.body ?? "");
        return jsonResponse({ access_token: "access", token_type: "bearer" });
      },
    });
    await endpoint.requestToken(
      new URLSearchParams({ grant_type: "authorization_code", code: "c" }),
    );
    const params = new URLSearchParams(body);
    expect(params.get("client_id")).toBe("shop-web");
    expect(params.get("client_secret")).toBe("secret");
  });

  it("classifies network failures as unavailable", async () => {
    const endpoint = createFetchTokenEndpoint({
      tokenEndpointUrl: tokenUrl,
      auth: { kind: "basic", clientId: "c", clientSecret: "s" },
      timeoutMs: 5_000,
      fetchImpl: async () => {
        throw new Error("timeout");
      },
    });
    await expect(endpoint.requestToken(new URLSearchParams())).rejects.toBeInstanceOf(
      IdentityUnavailableError,
    );
  });

  it("classifies 5xx, 429, and 408 as unavailable", async () => {
    for (const status of [503, 429, 408]) {
      const endpoint = createFetchTokenEndpoint({
        tokenEndpointUrl: tokenUrl,
        auth: { kind: "basic", clientId: "c", clientSecret: "s" },
        timeoutMs: 5_000,
        fetchImpl: async () => jsonResponse({ error: "slow_down" }, status),
      });
      await expect(endpoint.requestToken(new URLSearchParams())).rejects.toBeInstanceOf(
        IdentityUnavailableError,
      );
    }
  });

  it("classifies 400 invalid_grant as rejected with oauth error code", async () => {
    const endpoint = createFetchTokenEndpoint({
      tokenEndpointUrl: tokenUrl,
      auth: { kind: "basic", clientId: "c", clientSecret: "s" },
      timeoutMs: 5_000,
      fetchImpl: async () =>
        jsonResponse({ error: "invalid_grant", error_description: "expired" }, 400),
    });
    try {
      await endpoint.requestToken(new URLSearchParams());
    } catch (error) {
      expect(error).toBeInstanceOf(IdentityRejectedError);
      expect((error as IdentityRejectedError).oauthError).toBe("invalid_grant");
      return;
    }
    throw new Error("expected rejection");
  });

  it("classifies malformed 200 responses as unavailable", async () => {
    const endpoint = createFetchTokenEndpoint({
      tokenEndpointUrl: tokenUrl,
      auth: { kind: "basic", clientId: "c", clientSecret: "s" },
      timeoutMs: 5_000,
      fetchImpl: async () => jsonResponse({ access_token: "only" }, 200),
    });
    await expect(endpoint.requestToken(new URLSearchParams())).rejects.toBeInstanceOf(
      IdentityUnavailableError,
    );
  });

  it("classifies non-json success bodies as unavailable", async () => {
    const endpoint = createFetchTokenEndpoint({
      tokenEndpointUrl: tokenUrl,
      auth: { kind: "basic", clientId: "c", clientSecret: "s" },
      timeoutMs: 5_000,
      fetchImpl: async () => new Response("not-json", { status: 200 }),
    });
    await expect(endpoint.requestToken(new URLSearchParams())).rejects.toBeInstanceOf(
      IdentityUnavailableError,
    );
  });
});
