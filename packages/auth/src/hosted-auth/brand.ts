import {
  REGISTERED_OIDC_CLIENTS,
  REGISTERED_OIDC_CLIENT_IDS,
  type RegisteredOidcClientId,
} from "@auction/identity-contracts";
import { HOSTED_COPY } from "./copy.js";

/** The destination product, shown as a text chip under the heading. */
export type HostedProductChip = {
  label: string;
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
    chip: { label: HOSTED_COPY.products.bid },
  },
  [REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_WEB]: {
    productName: HOSTED_COPY.products.shop,
    tagline: null,
    chip: { label: HOSTED_COPY.products.shop },
  },
  [REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_ADMIN]: {
    productName: HOSTED_COPY.products.shopAdmin,
    tagline: "Shop Admin",
    chip: { label: HOSTED_COPY.products.shopAdmin },
  },
  [REGISTERED_OIDC_CLIENT_IDS.LAX_ART_WEB]: {
    productName: HOSTED_COPY.products.art,
    tagline: null,
    chip: { label: HOSTED_COPY.products.art },
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
