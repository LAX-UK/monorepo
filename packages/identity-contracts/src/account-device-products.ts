import type { RegisteredOidcClientId } from "./clients.js";

/**
 * The products the device list names, in the order it names them. The ids are written out (and
 * checked against the registered clients) so this file stays free of the client registry and is
 * safe to bundle into the browser.
 */
export const DEVICE_LIST_PRODUCTS = [
  { name: "LAX Account", clientId: "lax-account-web" },
  { name: "LAX Bid", clientId: "lax-bid-web" },
  { name: "LAX Shop", clientId: "lax-shop-web" },
  { name: "lax.art", clientId: "lax-art-web" },
] as const satisfies readonly { name: string; clientId: RegisteredOidcClientId }[];

/**
 * The product names for the OAuth clients a browser has used, in the fixed list order. Clients
 * that are not one of the four public products (staff tools, mobile) are left out.
 */
export function deviceProductNames(clientIds: readonly string[]): string[] {
  return DEVICE_LIST_PRODUCTS.filter((product) => clientIds.includes(product.clientId)).map(
    (product) => product.name,
  );
}
