/**
 * The `__Host-` prefix makes browsers reject the cookie unless it is `Secure`, and sign-in only
 * sets `Secure` in production. Over plain http://localhost the prefixed cookie would be dropped
 * and sign-in would loop, so the prefix is production-only.
 */
export const SHOP_ADMIN_SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-lax-shop-admin-session"
    : "lax-shop-admin-session";
export const SHOP_ADMIN_CSRF_COOKIE = "lax-shop-admin-csrf";
export const SHOP_ADMIN_LOGIN_COOKIE = "lax-shop-admin-login-pending";
export const SHOP_ADMIN_LOGIN_ATTEMPT_COOKIE = "lax-shop-admin-login-attempt";
/** One-shot guard when the pending login cookie expired but Auth returned a code. */
export const SHOP_ADMIN_LOGIN_RETRY_COOKIE = "lax-shop-admin-login-retry";
