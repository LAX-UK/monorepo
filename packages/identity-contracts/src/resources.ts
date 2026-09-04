export const LAX_RESOURCE_IDS = {
  LAX_BID_API: "lax-bid-api",
  LAX_WS: "lax-ws",
  LAX_SHOP_API: "lax-shop-api",
} as const;

export type LaxResourceId = (typeof LAX_RESOURCE_IDS)[keyof typeof LAX_RESOURCE_IDS];

export type ProductScope = "bid.read" | "bid.write" | "shop.read" | "shop.write";

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
    allowedScopes: ["bid.read", "bid.write"],
  },
  [LAX_RESOURCE_IDS.LAX_WS]: {
    id: LAX_RESOURCE_IDS.LAX_WS,
    uri: "https://ws.lax.bid",
    allowedScopes: ["bid.read"],
  },
  [LAX_RESOURCE_IDS.LAX_SHOP_API]: {
    id: LAX_RESOURCE_IDS.LAX_SHOP_API,
    uri: "https://shop.lax.art/api",
    allowedScopes: ["shop.read", "shop.write"],
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

const STANDARD_OIDC_SCOPES = ["openid", "profile", "email", "offline_access"] as const;

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
