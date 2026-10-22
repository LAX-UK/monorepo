/**
 * The `__Host-` prefix makes browsers reject the cookie unless it is `Secure`, and sign-in only
 * sets `Secure` in production. Over plain http://localhost the prefixed cookie would be dropped
 * and sign-in would loop, so the prefix is production-only.
 */
const SECURE_SESSION_COOKIE = "__Host-lax-shop-admin-session";
const LOCAL_SESSION_COOKIE = "lax-shop-admin-session";

export function shopAdminSessionCookie(config: { NODE_ENV: string }): string {
  return config.NODE_ENV === "production" ? SECURE_SESSION_COOKIE : LOCAL_SESSION_COOKIE;
}

/**
 * Edge middleware cannot load the server config, so it accepts either name. It only decides
 * whether to send the browser to sign-in; the session itself is validated server-side.
 */
export const SHOP_ADMIN_SESSION_COOKIE_NAMES = [
  SECURE_SESSION_COOKIE,
  LOCAL_SESSION_COOKIE,
] as const;
export const SHOP_ADMIN_CSRF_COOKIE = "lax-shop-admin-csrf";
export const SHOP_ADMIN_LOGIN_COOKIE = "lax-shop-admin-login-pending";
export const SHOP_ADMIN_LOGIN_ATTEMPT_COOKIE = "lax-shop-admin-login-attempt";
/** One-shot guard when the pending login cookie expired but Auth returned a code. */
export const SHOP_ADMIN_LOGIN_RETRY_COOKIE = "lax-shop-admin-login-retry";
