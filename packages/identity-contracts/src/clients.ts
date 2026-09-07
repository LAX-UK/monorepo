import type { OidcDiscoveryDocument } from "./discovery.js";
import { LAX_RESOURCE_IDS, type LaxResourceId } from "./resources.js";

export enum OidcClientKind {
  Public = "public",
  Confidential = "confidential",
}

export const REGISTERED_OIDC_CLIENT_IDS = {
  LAX_BID_WEB: "lax-bid-web",
  LAX_SHOP_WEB: "lax-shop-web",
  WS_MOBILE: "ws-mobile",
} as const;

export type RegisteredOidcClientId =
  (typeof REGISTERED_OIDC_CLIENT_IDS)[keyof typeof REGISTERED_OIDC_CLIENT_IDS];

export type IdentityScope = OidcDiscoveryDocument["scopes_supported"][number];

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
      backchannelLogoutUri: "https://lax.bid/api/auth/backchannel-logout",
      testBackchannelLogoutUri: "https://test.lax.bid/api/auth/backchannel-logout",
      backchannelLogoutSessionRequired: true,
    },
    [REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_WEB]: {
      clientId: REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_WEB,
      kind: OidcClientKind.Confidential,
      displayName: "LAX Shop Web",
      redirectUris: [
        "http://localhost:3010/auth/callback",
        "https://shop.lax.art/auth/callback",
        "https://test-shop.lax.art/auth/callback",
      ],
      postLogoutRedirectUris: [
        "http://localhost:3010/",
        "https://shop.lax.art/",
        "https://test-shop.lax.art/",
      ],
      allowedScopes: ["openid", "profile", "email", "offline_access", "shop.read", "shop.write"],
      allowedResources: [LAX_RESOURCE_IDS.LAX_SHOP_API],
      pkceRequired: true,
      backchannelLogoutUri: "https://shop.lax.art/api/auth/backchannel-logout",
      testBackchannelLogoutUri: "https://test-shop.lax.art/api/auth/backchannel-logout",
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
    },
  };
