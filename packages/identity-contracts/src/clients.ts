import type { OidcDiscoveryDocument } from "./discovery.js";
import { LAX_RESOURCE_IDS, type LaxResourceId } from "./resources.js";

export enum OidcClientKind {
  Public = "public",
  Confidential = "confidential",
}

export const REGISTERED_OIDC_CLIENT_IDS = {
  LAX_BID_WEB: "lax-bid-web",
  LAX_SHOP_WEB: "lax-shop-web",
  LAX_SHOP_ADMIN: "lax-shop-admin",
  LAX_ACCOUNT_WEB: "lax-account-web",
  WS_MOBILE: "ws-mobile",
} as const;

export type RegisteredOidcClientId =
  (typeof REGISTERED_OIDC_CLIENT_IDS)[keyof typeof REGISTERED_OIDC_CLIENT_IDS];

export type IdentityScope = OidcDiscoveryDocument["scopes_supported"][number];

/**
 * `implicit` skips the OIDC consent screen for first-party confidential web
 * products. `explicit` keeps Deny/Allow (mobile custom URIs and future
 * third-party clients). `prompt=consent` still forces the screen.
 */
export type OidcConsentPolicy = "implicit" | "explicit";

export type RegisteredOidcClientMetadata = {
  clientId: RegisteredOidcClientId;
  kind: OidcClientKind;
  displayName: string;
  redirectUris: readonly string[];
  /** Exact RP-Initiated Logout redirect URIs; never reused as login callbacks. */
  postLogoutRedirectUris: readonly string[];
  allowedScopes: readonly IdentityScope[];
  allowedResources: readonly LaxResourceId[];
  /** Mandatory for public/browser clients per OAuth 2.0 Security BCP. */
  pkceRequired: boolean;
  consentPolicy: OidcConsentPolicy;
  /** Exact future OpenID Connect Back-Channel Logout endpoint, when supported by the RP. */
  backchannelLogoutUri?: string | undefined;
  /** Staging receiver on the same product origin boundary. */
  testBackchannelLogoutUri?: string | undefined;
  /** The RP requires the OP's logout token to carry the browser-session `sid`. */
  backchannelLogoutSessionRequired?: boolean | undefined;
};

export const REGISTERED_OIDC_CLIENTS: Record<RegisteredOidcClientId, RegisteredOidcClientMetadata> =
  {
    [REGISTERED_OIDC_CLIENT_IDS.LAX_BID_WEB]: {
      clientId: REGISTERED_OIDC_CLIENT_IDS.LAX_BID_WEB,
      kind: OidcClientKind.Confidential,
      displayName: "LAX Bid Web",
      redirectUris: [
        "http://localhost:3000/api/auth/callback/lax-bid-web",
        "https://lax.bid/api/auth/callback/lax-bid-web",
        "https://test.lax.bid/api/auth/callback/lax-bid-web",
      ],
      postLogoutRedirectUris: [
        "http://localhost:3000/",
        "https://lax.bid/",
        "https://test.lax.bid/",
      ],
      allowedScopes: ["openid", "profile", "email", "offline_access", "bid.read", "bid.write"],
      allowedResources: [LAX_RESOURCE_IDS.LAX_BID_API, LAX_RESOURCE_IDS.LAX_WS],
      pkceRequired: true,
      consentPolicy: "implicit",
      backchannelLogoutUri: "https://lax.bid/api/auth/backchannel-logout",
      testBackchannelLogoutUri: "https://test.lax.bid/api/auth/backchannel-logout",
      backchannelLogoutSessionRequired: true,
    },
    [REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_ADMIN]: {
      clientId: REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_ADMIN,
      kind: OidcClientKind.Confidential,
      displayName: "LAX Shop Admin",
      redirectUris: [
        "http://localhost:3030/api/auth/callback",
        "https://test-shop-admin.lax.bid/api/auth/callback",
        "https://admin.shop.lax.art/api/auth/callback",
      ],
      postLogoutRedirectUris: [
        "http://localhost:3030/",
        "https://test-shop-admin.lax.bid/",
        "https://admin.shop.lax.art/",
      ],
      allowedScopes: ["openid", "profile", "email", "offline_access", "shop.admin"],
      allowedResources: [LAX_RESOURCE_IDS.LAX_SHOP_API],
      pkceRequired: true,
      consentPolicy: "implicit",
      backchannelLogoutUri: "https://admin.shop.lax.art/api/auth/backchannel-logout",
      testBackchannelLogoutUri: "https://test-shop-admin.lax.bid/api/auth/backchannel-logout",
      backchannelLogoutSessionRequired: true,
    },
    [REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_WEB]: {
      clientId: REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_WEB,
      kind: OidcClientKind.Confidential,
      displayName: "LAX Shop Web",
      redirectUris: [
        "http://localhost:3010/auth/callback",
        "https://shop.lax.art/auth/callback",
        "https://test-shop.lax.bid/auth/callback",
      ],
      postLogoutRedirectUris: [
        "http://localhost:3010/",
        "http://localhost:3020/",
        "http://localhost:3020/signed-out",
        "https://shop.lax.art/",
        "https://shop.lax.art/signed-out",
        "https://test-shop.lax.bid/",
        "https://test-shop.lax.bid/signed-out",
      ],
      allowedScopes: [
        "openid",
        "profile",
        "email",
        "offline_access",
        "phone",
        "shop.read",
        "shop.write",
      ],
      allowedResources: [LAX_RESOURCE_IDS.LAX_SHOP_API],
      pkceRequired: true,
      consentPolicy: "implicit",
      backchannelLogoutUri: "https://shop.lax.art/api/auth/backchannel-logout",
      testBackchannelLogoutUri: "https://test-shop.lax.bid/api/auth/backchannel-logout",
      backchannelLogoutSessionRequired: true,
    },
    [REGISTERED_OIDC_CLIENT_IDS.LAX_ACCOUNT_WEB]: {
      clientId: REGISTERED_OIDC_CLIENT_IDS.LAX_ACCOUNT_WEB,
      kind: OidcClientKind.Confidential,
      displayName: "LAX Account",
      redirectUris: [
        "http://localhost:3040/api/auth/callback",
        "https://test-account.lax.bid/api/auth/callback",
        "https://account.lax.bid/api/auth/callback",
      ],
      postLogoutRedirectUris: [
        "http://localhost:3040/",
        "https://test-account.lax.bid/",
        "https://account.lax.bid/",
      ],
      allowedScopes: ["openid", "profile", "email", "offline_access", "phone"],
      allowedResources: [],
      pkceRequired: true,
      consentPolicy: "implicit",
      backchannelLogoutUri: "https://account.lax.bid/api/auth/backchannel-logout",
      testBackchannelLogoutUri: "https://test-account.lax.bid/api/auth/backchannel-logout",
      backchannelLogoutSessionRequired: true,
    },
    [REGISTERED_OIDC_CLIENT_IDS.WS_MOBILE]: {
      clientId: REGISTERED_OIDC_CLIENT_IDS.WS_MOBILE,
      kind: OidcClientKind.Public,
      displayName: "WebSocket / Mobile",
      redirectUris: ["com.lax.bid:/oauth/callback"],
      postLogoutRedirectUris: [],
      allowedScopes: ["openid", "profile", "email", "offline_access", "bid.read"],
      allowedResources: [LAX_RESOURCE_IDS.LAX_WS],
      pkceRequired: true,
      consentPolicy: "explicit",
    },
  };

export function isRegisteredOidcClientId(value: string): value is RegisteredOidcClientId {
  return Object.hasOwn(REGISTERED_OIDC_CLIENTS, value);
}

export function oidcClientIdsWithImplicitConsent(): readonly RegisteredOidcClientId[] {
  return Object.values(REGISTERED_OIDC_CLIENTS)
    .filter((client) => client.consentPolicy === "implicit")
    .map((client) => client.clientId);
}
