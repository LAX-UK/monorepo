/**
 * The name the pending sign-in used before it was signed and `__Host-` prefixed. It is no longer
 * read (an unsigned value cannot be trusted): a sign-in started before the deploy finds no
 * pending cookie, and the callback restarts it once automatically. Only cleared.
 */
export const LAX_ACCOUNT_LOGIN_COOKIE = "lax-account-login-pending";
export const LAX_ACCOUNT_LOGIN_RETRY_COOKIE = "lax-account-login-retry";

export type AccountCookiePolicy = {
  secure: boolean;
  sessionCookie: string;
  /** The signed pending-login cookie. */
  loginCookie: string;
};

/**
 * Browsers reject `__Host-` cookies that are not `Secure`, so plain-HTTP local
 * origins use an unprefixed name instead of silently losing the session.
 */
export function accountCookiePolicy(publicOrigin: string): AccountCookiePolicy {
  const secure = publicOrigin.startsWith("https://");
  return {
    secure,
    sessionCookie: secure ? "__Host-lax-account-session" : "lax-account-session",
    loginCookie: secure ? "__Host-lax-account-login" : "lax-account-login",
  };
}
