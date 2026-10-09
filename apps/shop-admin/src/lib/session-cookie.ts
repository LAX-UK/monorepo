export const SHOP_ADMIN_SESSION_COOKIE = "__Host-lax-shop-admin-session";
export const SHOP_ADMIN_CSRF_COOKIE = "lax-shop-admin-csrf";
export const SHOP_ADMIN_LOGIN_COOKIE = "lax-shop-admin-login-pending";
export const SHOP_ADMIN_LOGIN_ATTEMPT_COOKIE = "lax-shop-admin-login-attempt";
/** One-shot guard when the pending login cookie expired but Auth returned a code. */
export const SHOP_ADMIN_LOGIN_RETRY_COOKIE = "lax-shop-admin-login-retry";
