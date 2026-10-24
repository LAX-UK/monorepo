export const LAX_RESOURCE_IDS = {
  LAX_BID_API: "lax-bid-api",
  LAX_WS: "lax-ws",
  LAX_SHOP_API: "lax-shop-api",
} as const;

export type LaxResourceId = (typeof LAX_RESOURCE_IDS)[keyof typeof LAX_RESOURCE_IDS];

/**
 * `lax.portfolio.read` is the narrow, read-only scope LAX Account exchanges for to list a
 * person's own works and money. Each product accepts it on its portfolio routes only.
 * `lax.staff.tools.read` is the read-only scope LAX Admin exchanges for to ask Bid which staff
 * tools the signed-in person can open; Bid accepts it on that one route only.
 * `lax.selling.read` and `lax.selling.write` are the scopes LAX Account exchanges for to act as
 * the person on their own Shop seller tools (sale limits requests, sales, payouts); Shop accepts
 * them on the seller routes only.
 */
export type ProductScope =
  | "bid.read"
  | "bid.write"
  | "shop.read"
  | "shop.write"
  | "shop.admin"
  | "lax.portfolio.read"
  | "lax.selling.read"
  | "lax.selling.write"
  | "lax.staff.tools.read";

export type LaxResourceMetadata = {
  id: LaxResourceId;
  /** Canonical RFC 8707 resource indicator accepted by the token endpoint. */
  uri: string;
  allowedScopes: readonly ProductScope[];
};

/**
 * First-party resource registry. `lax.art` is intentionally absent: the
 * marketing property has no API resource.
 */
export const LAX_RESOURCES: Record<LaxResourceId, LaxResourceMetadata> = {
  [LAX_RESOURCE_IDS.LAX_BID_API]: {
    id: LAX_RESOURCE_IDS.LAX_BID_API,
    uri: "https://api.lax.bid",
    allowedScopes: ["bid.read", "bid.write", "lax.portfolio.read", "lax.staff.tools.read"],
  },
  [LAX_RESOURCE_IDS.LAX_WS]: {
    id: LAX_RESOURCE_IDS.LAX_WS,
    uri: "https://ws.lax.bid",
    allowedScopes: ["bid.read"],
  },
  [LAX_RESOURCE_IDS.LAX_SHOP_API]: {
    id: LAX_RESOURCE_IDS.LAX_SHOP_API,
    uri: "https://shop.lax.art/api",
    allowedScopes: [
      "shop.read",
      "shop.write",
      "shop.admin",
      "lax.portfolio.read",
      "lax.selling.read",
      "lax.selling.write",
    ],
  },
};

export function findLaxResource(resource: string): LaxResourceMetadata | undefined {
  return findLaxResourceById(resource) ?? findLaxResourceByUri(resource);
}

export function findLaxResourceById(resourceId: string): LaxResourceMetadata | undefined {
  return Object.values(LAX_RESOURCES).find((candidate) => candidate.id === resourceId);
}

export function findLaxResourceByUri(resourceUri: string): LaxResourceMetadata | undefined {
  return Object.values(LAX_RESOURCES).find((candidate) => candidate.uri === resourceUri);
}

const STANDARD_OIDC_SCOPES = ["openid", "profile", "email", "offline_access", "phone"] as const;

/** Product scopes registered in {@link LAX_RESOURCES}, plus standard OIDC scopes. */
export function allRegisteredOidcScopes(): readonly string[] {
  const productScopes = new Set<ProductScope>();
  for (const resource of Object.values(LAX_RESOURCES)) {
    for (const scope of resource.allowedScopes) {
      productScopes.add(scope);
    }
  }
  return [...STANDARD_OIDC_SCOPES, ...Array.from(productScopes).sort()];
}
