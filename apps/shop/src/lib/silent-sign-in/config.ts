export function isShopSilentSsoEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SILENT_SSO_ENABLED === "true";
}

export const SHOP_SILENT_SSO_COOKIE_PREFIX = "shop_sso";

export const SHOP_SILENT_NOTICE_COOKIE = `${SHOP_SILENT_SSO_COOKIE_PREFIX}_notice`;
