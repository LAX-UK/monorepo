import { describe, expect, it, vi } from "vitest";
import { createShopIdentityApp } from "../create-shop-identity-app.js";
import type { OidcDiscovery } from "../oidc.js";
import type { ShopIdentitySession, ShopSessionRepository } from "../session.js";
import { OIDC_ID_TOKEN_COOKIE_NAME, SESSION_COOKIE_NAME } from "../session.js";
import type { ShopIdentityAppDeps } from "../shop-identity-app-deps.js";
import { createTestTokenService } from "../test/token-service.mock.js";

const SESSION_ID = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEfg";
const ID_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzdWItMSJ9.signature";

const baseEnv = {
  NODE_ENV: "test" as const,
  PORT: 3010,
  OIDC_ISSUER_URL: "https://auth.example.test",
  OIDC_CLIENT_ID: "lax-shop-web",
  OIDC_CLIENT_SECRET: "super-secret-client-value-32-characters",
  OIDC_REDIRECT_URI: "http://localhost:3010/auth/callback",
  OIDC_POST_LOGOUT_REDIRECT_URI: "http://localhost:3020/",
  SHOP_STOREFRONT_URL: "http://localhost:3020",
  SHOP_API_BASE_URL: "http://localhost:3011",
  SHOP_API_BFF_TOKEN: "test-bff-token-minimum-32-characters-long",
  DATABASE_URL_SHOP: "postgres://shop:shop@127.0.0.1:5432/shop",
  FEDCM_ENABLED: false,
};

function createTestApp(overrides: {
  sessionRepository: ShopSessionRepository;
  findShopProfile: ShopIdentityAppDeps["findShopProfile"];
  tokenService?: ShopIdentityAppDeps["tokenService"];
}) {
  const deps: ShopIdentityAppDeps = {
    env: baseEnv,
    release: "test",
    sessionRepository: overrides.sessionRepository,
    tokenService: overrides.tokenService ?? createTestTokenService(),
    discovery: {
      issuer: baseEnv.OIDC_ISSUER_URL,
      authorization_endpoint: "https://auth.example.test/authorize",
      end_session_endpoint: "https://auth.example.test/logout",
      jwks_uri: "https://auth.example.test/jwks",
    } as unknown as OidcDiscovery,
    secureCookies: false,
    findShopProfile: overrides.findShopProfile,
    checkDatabase: vi.fn(),
    checkIdentityProvider: vi.fn(),
    completeOAuthCallback: vi.fn(),
    verifyLogoutToken: vi.fn(),
  };
  return createShopIdentityApp(deps, {
    replayStore: {} as never,
    issuer: baseEnv.OIDC_ISSUER_URL,
    jwksUrl: "https://auth.example.test/jwks",
  });
}

describe("GET /me", () => {
  it("returns 401 for guests", async () => {
    const sessionRepository: ShopSessionRepository = {
      findActive: vi.fn(async () => null),
      createPendingOAuth: vi.fn(),
      attachPendingOAuthToAuthenticatedSession: vi.fn(async () => true),
      createGuestSession: vi.fn(),
      authenticate: vi.fn(),
      invalidate: vi.fn(),
      consumeLogoutToken: vi.fn(),
    };
    const app = createTestApp({
      sessionRepository,
      findShopProfile: vi.fn(),
    });
    const response = await app.request("/me");
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ authenticated: false });
  });

  it("returns 403 when profile is disabled", async () => {
    const session: ShopIdentitySession = {
      id: "sess-1",
      subject: "sub-1",
      sid: "sid-1",
      oauth: null,
    };
    const sessionRepository: ShopSessionRepository = {
      findActive: vi.fn(async () => session),
      createPendingOAuth: vi.fn(),
      attachPendingOAuthToAuthenticatedSession: vi.fn(async () => true),
      createGuestSession: vi.fn(),
      authenticate: vi.fn(),
      invalidate: vi.fn(async () => undefined),
      consumeLogoutToken: vi.fn(),
    };
    const app = createTestApp({
      sessionRepository,
      findShopProfile: vi.fn(async () => ({
        identitySubjectId: "sub-1",
        email: "a@example.com",
        name: "A",
        disabledAt: new Date(),
      })),
    });
    const response = await app.request("/me", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${SESSION_ID}; ${OIDC_ID_TOKEN_COOKIE_NAME}=${ID_TOKEN}`,
      },
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      authenticated: false,
      reason: "identity_disabled",
    });
    expect(sessionRepository.invalidate).toHaveBeenCalledWith("sess-1");
  });

  it("reports tokenUpgradeRequired when no refresh token is stored", async () => {
    const session: ShopIdentitySession = {
      id: "sess-upgrade",
      subject: "sub-upgrade",
      sid: "sid-upgrade",
      oauth: null,
    };
    const sessionRepository: ShopSessionRepository = {
      findActive: vi.fn(async () => session),
      createPendingOAuth: vi.fn(),
      attachPendingOAuthToAuthenticatedSession: vi.fn(async () => true),
      createGuestSession: vi.fn(),
      authenticate: vi.fn(),
      invalidate: vi.fn(),
      consumeLogoutToken: vi.fn(),
    };
    const app = createTestApp({
      sessionRepository,
      findShopProfile: vi.fn(async () => ({
        identitySubjectId: "sub-upgrade",
        email: "upgrade@example.com",
        name: "Upgrade User",
        disabledAt: null,
      })),
      tokenService: createTestTokenService({
        hasStoredRefreshToken: vi.fn(async () => false),
      }),
    });
    const response = await app.request("/me", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${SESSION_ID}` },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      authenticated: true,
      tokenUpgradeRequired: true,
    });
  });

  it("returns profile for authenticated sessions", async () => {
    const session: ShopIdentitySession = {
      id: "sess-2",
      subject: "sub-2",
      sid: "sid-2",
      oauth: null,
    };
    const profile = {
      identitySubjectId: "sub-2",
      email: "shop@example.com",
      name: "Shop User",
      disabledAt: null,
    };
    const sessionRepository: ShopSessionRepository = {
      findActive: vi.fn(async () => session),
      createPendingOAuth: vi.fn(),
      attachPendingOAuthToAuthenticatedSession: vi.fn(async () => true),
      createGuestSession: vi.fn(),
      authenticate: vi.fn(),
      invalidate: vi.fn(),
      consumeLogoutToken: vi.fn(),
    };
    const app = createTestApp({
      sessionRepository,
      findShopProfile: vi.fn(async () => profile),
    });
    const response = await app.request("/me", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${SESSION_ID}; ${OIDC_ID_TOKEN_COOKIE_NAME}=${ID_TOKEN}`,
      },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authenticated: true,
      subject: "sub-2",
      profile,
      tokenUpgradeRequired: false,
    });
  });
});
