import { describe, expect, it, vi } from "vitest";
import { resolveAuthBaseUrl } from "./client.js";
import {
  AUTH_NO_STORE_HEADERS,
  buildOidcDiscoveryDocument,
  buildTrustedAuthOrigins,
  createAuthLifecycleCallbacks,
  createAuthNoStoreMiddleware,
} from "./contracts.js";

describe("auth issuer contracts", () => {
  it("builds the frozen OIDC discovery document from a normalized issuer", () => {
    expect(buildOidcDiscoveryDocument("https://auth.lax.bid///")).toEqual({
      issuer: "https://auth.lax.bid",
      authorization_endpoint: "https://auth.lax.bid/api/auth/oauth2/authorize",
      token_endpoint: "https://auth.lax.bid/api/auth/oauth2/token",
      userinfo_endpoint: "https://auth.lax.bid/api/auth/oauth2/userinfo",
      jwks_uri: "https://auth.lax.bid/.well-known/jwks.json",
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      acr_values_supported: ["urn:mace:incommon:iap:silver", "urn:mace:incommon:iap:bronze"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      scopes_supported: ["openid", "profile", "email", "offline_access"],
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
      claims_supported: [
        "sub",
        "iss",
        "aud",
        "exp",
        "nbf",
        "iat",
        "jti",
        "email",
        "email_verified",
        "name",
        "role",
        "staff_role",
      ],
      code_challenge_methods_supported: ["S256"],
    });
  });

  it("deduplicates composition-root trusted origins", () => {
    expect(
      buildTrustedAuthOrigins({
        webOrigin: "https://lax.bid",
        webOrigins: ["https://lax.bid", "https://event.lax.bid"],
        additionalOrigins: ["https://lax.bid", "https://internal.lax.bid"],
      }),
    ).toEqual(["https://lax.bid", "https://event.lax.bid", "https://internal.lax.bid"]);
  });

  it("applies the frozen no-store response headers after the handler", async () => {
    const header = vi.fn();
    const next = vi.fn(async () => undefined);
    await createAuthNoStoreMiddleware()({ header }, next);
    expect(next).toHaveBeenCalledOnce();
    for (const [name, value] of Object.entries(AUTH_NO_STORE_HEADERS)) {
      expect(header).toHaveBeenCalledWith(name, value);
    }
  });

  it("prefers the auth issuer for browser and server clients", () => {
    expect(
      resolveAuthBaseUrl({
        authUrl: "https://auth.lax.bid/",
        apiUrl: "https://api.lax.bid/",
      }),
    ).toBe("https://auth.lax.bid");
  });
});

describe("auth lifecycle callback contract", () => {
  it("runs user effects before account attribution and registration", async () => {
    const calls: string[] = [];
    const callbacks = createAuthLifecycleCallbacks({
      markUserForOAuthAttribution: async () => {
        calls.push("attribution");
      },
      ensurePersonalLegalEntity: async () => {
        calls.push("legal-entity");
      },
      publishUserRegisteredForAccount: async () => {
        calls.push("registered");
      },
      completeOAuthAttribution: async () => {
        calls.push("account");
      },
      publishUserEmailVerified: async () => {
        calls.push("verified");
      },
    });
    const user = { id: "user-1", email: "user@example.com", name: "User" };
    await callbacks.onUserCreated?.(user);
    await callbacks.onAccountCreated?.({ userId: user.id, providerId: "google" });
    await callbacks.onEmailVerified?.(user);
    expect(calls).toEqual(["attribution", "legal-entity", "account", "registered", "verified"]);
  });

  it("keeps attribution marking non-blocking without swallowing required effects", async () => {
    const onNonBlockingError = vi.fn();
    const publishUserRegisteredForAccount = vi.fn(async () => undefined);
    const callbacks = createAuthLifecycleCallbacks({
      markUserForOAuthAttribution: async () => {
        throw new Error("redis unavailable");
      },
      publishUserRegisteredForAccount,
      onNonBlockingError,
    });
    await callbacks.onUserCreated?.({
      id: "user-1",
      email: "user@example.com",
      name: "User",
    });
    await callbacks.onAccountCreated?.({ userId: "user-1", providerId: "credential" });
    expect(onNonBlockingError).toHaveBeenCalledWith(
      "oauth-attribution",
      expect.any(Error),
      "user-1",
    );
    expect(publishUserRegisteredForAccount).toHaveBeenCalledOnce();
  });
});
