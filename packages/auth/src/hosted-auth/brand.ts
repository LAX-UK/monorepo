import { REGISTERED_OIDC_CLIENTS, REGISTERED_OIDC_CLIENT_IDS } from "@auction/identity-contracts";

export const HOSTED_SHOP_LOGO_PATH = "/hosted-auth/lax-shop-logo.svg";
export const HOSTED_BID_LOGO_PATH = "/hosted-auth/lax-bid-logo.svg";
export const HOSTED_BID_LOGO_LIGHT_PATH = "/hosted-auth/lax-bid-logo-light.svg";

export type HostedAuthTheme = "shop" | "bid" | "default";

export type HostedBrandProfile = {
  theme: HostedAuthTheme;
  productName: string;
  logoSrc: string | null;
  logoDarkSrc: string | null;
  logoAlt: string | null;
  tagline: string | null;
};

const DEFAULT_BRAND: HostedBrandProfile = {
  theme: "shop",
  productName: "LAX",
  logoSrc: HOSTED_SHOP_LOGO_PATH,
  logoDarkSrc: null,
  logoAlt: "LAX",
  tagline: null,
};

export function selectHostedBrand(clientId: string | null | undefined): HostedBrandProfile {
  if (clientId === REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_ADMIN) {
    return {
      theme: "shop",
      productName: "LAX Shop Admin",
      logoSrc: HOSTED_SHOP_LOGO_PATH,
      logoDarkSrc: null,
      logoAlt: "LAX Shop Admin",
      tagline: "Shop Admin",
    };
  }
  if (clientId === REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_WEB) {
    return {
      theme: "shop",
      productName: "LAX Shop",
      logoSrc: HOSTED_SHOP_LOGO_PATH,
      logoDarkSrc: null,
      logoAlt: "LAX Shop",
      tagline: null,
    };
  }
  if (clientId === REGISTERED_OIDC_CLIENT_IDS.LAX_BID_WEB) {
    return {
      theme: "bid",
      productName: "LAX Bid",
      logoSrc: HOSTED_BID_LOGO_PATH,
      logoDarkSrc: HOSTED_BID_LOGO_LIGHT_PATH,
      logoAlt: "LAX Bid",
      tagline: null,
    };
  }
  return DEFAULT_BRAND;
}

export function selectHostedBrandFromClientName(
  clientName: string | null | undefined,
): HostedBrandProfile {
  if (!clientName) return DEFAULT_BRAND;
  for (const client of Object.values(REGISTERED_OIDC_CLIENTS)) {
    if (client.displayName === clientName) {
      return selectHostedBrand(client.clientId);
    }
  }
  return DEFAULT_BRAND;
}
