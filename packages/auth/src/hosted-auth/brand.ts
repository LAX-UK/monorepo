import {
  REGISTERED_OIDC_CLIENTS,
  REGISTERED_OIDC_CLIENT_IDS,
  type RegisteredOidcClientId,
} from "@auction/identity-contracts";
import { HOSTED_COPY } from "./copy.js";

/** A product that sets its own name in its own colour on the hosted pages. */
export type HostedNamedProduct = "bid" | "shop" | "art";

/** The destination product, named in a quiet line under the heading ("to continue to LAX Bid"). */
export type HostedProductChip = {
  label: string;
  product: HostedNamedProduct;
};

export type HostedBrandProfile = {
  /** The product the user is heading to; the LAX Account when the client is Account itself or unknown. */
  productName: string;
  tagline: string | null;
  /** Null for Account itself and for unknown clients: there is no other product to name. */
  chip: HostedProductChip | null;
};

const ACCOUNT_BRAND: HostedBrandProfile = {
  productName: HOSTED_COPY.accountName,
  tagline: null,
  chip: null,
};

const PRODUCT_BRANDS: Partial<Record<RegisteredOidcClientId, HostedBrandProfile>> = {
  [REGISTERED_OIDC_CLIENT_IDS.LAX_BID_WEB]: {
    productName: HOSTED_COPY.products.bid,
    tagline: null,
    chip: { label: HOSTED_COPY.products.bid, product: "bid" },
  },
  [REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_WEB]: {
    productName: HOSTED_COPY.products.shop,
    tagline: null,
    chip: { label: HOSTED_COPY.products.shop, product: "shop" },
  },
  [REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_ADMIN]: {
    productName: HOSTED_COPY.products.shopAdmin,
    tagline: "Shop Admin",
    chip: { label: HOSTED_COPY.products.shopAdmin, product: "shop" },
  },
  [REGISTERED_OIDC_CLIENT_IDS.LAX_ART_WEB]: {
    productName: HOSTED_COPY.products.art,
    tagline: null,
    chip: { label: HOSTED_COPY.products.art, product: "art" },
  },
};

export function selectHostedBrand(clientId: string | null | undefined): HostedBrandProfile {
  if (!clientId || !Object.hasOwn(PRODUCT_BRANDS, clientId)) return ACCOUNT_BRAND;
  return PRODUCT_BRANDS[clientId as RegisteredOidcClientId] ?? ACCOUNT_BRAND;
}

/** The consent screen only receives the client's display name, so it is mapped back to the registry. */
export function resolveRegisteredClientIdByName(
  clientName: string | null | undefined,
): RegisteredOidcClientId | null {
  if (!clientName) return null;
  for (const client of Object.values(REGISTERED_OIDC_CLIENTS)) {
    if (client.displayName === clientName) return client.clientId;
  }
  return null;
}

export function selectHostedBrandFromClientName(
  clientName: string | null | undefined,
): HostedBrandProfile {
  return selectHostedBrand(resolveRegisteredClientIdByName(clientName));
}
