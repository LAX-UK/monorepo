import { REGISTERED_OIDC_CLIENT_IDS } from "@auction/identity-contracts";

/** The products a person recognises a device by, in the order they are named. */
const DEVICE_PRODUCTS = [
  { name: "LAX Account", clientId: REGISTERED_OIDC_CLIENT_IDS.LAX_ACCOUNT_WEB },
  { name: "LAX Bid", clientId: REGISTERED_OIDC_CLIENT_IDS.LAX_BID_WEB },
  { name: "LAX Shop", clientId: REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_WEB },
  { name: "lax.art", clientId: REGISTERED_OIDC_CLIENT_IDS.LAX_ART_WEB },
] as const;

/**
 * The product names for the OAuth clients a browser has used, in the fixed order above. Clients
 * that are not one of the four public products (staff tools, mobile) are left out.
 */
export function deviceProductNames(clientIds: readonly string[]): string[] {
  return DEVICE_PRODUCTS.filter((product) => clientIds.includes(product.clientId)).map(
    (product) => product.name,
  );
}
