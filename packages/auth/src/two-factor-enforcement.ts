import { createHMAC } from "@better-auth/utils/hmac";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { deleteSessionCookie, expireCookie } from "better-auth/cookies";
import { generateRandomString } from "better-auth/crypto";
import { isSafeMagicLinkNextPath } from "./magic-link-callback.js";

type AuthUser = { id: string; email: string; name: string; twoFactorEnabled?: boolean | null };

/** Mirrors Better Auth's two-factor plugin internals so the pending challenge we
 * create here is consumable by its `/two-factor/verify-totp` / backup-code endpoints. */
const TWO_FACTOR_COOKIE_NAME = "two_factor";
const TRUST_DEVICE_COOKIE_NAME = "trust_device";
/** Better Auth `twoFactorCookieMaxAge` default. */
const PENDING_CHALLENGE_MAX_AGE_SEC = 600;
/** Better Auth `trustDeviceMaxAge` default (30 days). */
const TRUST_DEVICE_MAX_AGE_SEC = 30 * 24 * 60 * 60;

/**
 * Paths where a new session must NOT be challenged for app TOTP:
 * - Credential sign-ins: Better Auth's two-factor plugin already gates these natively
 *   (returns `twoFactorRedirect` instead of a session).
 * - `/two-factor/*`: the session created here IS the post-TOTP session.
 * - OAuth/social (`/sign-in/social`, `/callback/*`, `/oauth2/*`): policy decision — the
 *   identity provider is treated as a sufficient factor, and enforcing TOTP here would
 *   dead-end social-only 2FA users who have no password to complete the challenge with.
 */
const EXEMPT_PATH_PREFIXES = [
  "/sign-in/email",
  "/sign-in/username",
  "/sign-in/phone-number",
  "/sign-in/social",
  "/two-factor",
  "/callback",
  "/oauth2",
] as const;

export function isTwoFactorExemptPath(path: string): boolean {
  return EXEMPT_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Extracts a safe relative `next` from the verify `callbackURL` (absolute or relative)
 * so the TOTP challenge can preserve the user's original destination. */
export function extractNextFromCallbackUrl(callbackURL: string | null | undefined): string | null {
  if (!callbackURL) return null;
  let next: string | null = null;
  try {
    next = new URL(callbackURL, "https://placeholder.invalid").searchParams.get("next");
  } catch {
    return null;
  }
  return next && isSafeMagicLinkNextPath(next) ? next : null;
}

/** `/two-factor` challenge URL on the Identity issuer, with optional preserved `next`. */
export function buildTwoFactorChallengeUrl(authOrigin: string, callbackURL?: string | null): string {
  const base = `${authOrigin.replace(/\/$/, "")}/two-factor`;
  const next = extractNextFromCallbackUrl(callbackURL);
  const params = new URLSearchParams();
  if (next) params.set("next", next);
  if (callbackURL) params.set("callbackURL", callbackURL);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/** Hands a 2FA user off to the TOTP challenge instead of keeping a single-factor session:
 * revokes the fresh session, creates the same pending-2FA state Better Auth's credential
 * flow uses, and redirects to the challenge page. Honors trusted devices. Shared by every
 * passwordless sign-in surface (magic link, email-verify auto-sign-in, future methods).
 */
export async function enforceTwoFactorOnNewSession(deps: {
  user: AuthUser | null | undefined;
  sessionToken: string | null | undefined;
  challengeUrl: string;
  /** True when a valid trust-device cookie covers this user (challenge skipped). */
  isTrustedDevice: () => Promise<boolean>;
  deleteSession: (token: string) => Promise<void>;
  deleteCookie: () => void;
  /** Creates the verification record + signed `two_factor` cookie consumed by verify-totp. */
  createPendingChallenge: () => Promise<void>;
  /** Must throw (Better Auth redirects are control-flow exceptions). */
  redirect: (url: string) => never;
}): Promise<void> {
  const { user, sessionToken } = deps;
  if (!user || !sessionToken) return;
  if (!user.twoFactorEnabled) return;
  if (await deps.isTrustedDevice()) return;

  let revoked = false;
  for (let attempt = 0; attempt < 2 && !revoked; attempt += 1) {
    try {
      await deps.deleteSession(sessionToken);
      revoked = true;
    } catch (err) {
      console.error("[auth] 2FA enforcement session revoke failed", {
        userId: user.id,
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  deps.deleteCookie();
  try {
    await deps.createPendingChallenge();
  } catch (err) {
    // Without the pending cookie the challenge page bounces to /login — degraded but safe.
    console.error("[auth] 2FA pending challenge creation failed", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  deps.redirect(deps.challengeUrl);
}

type AuthHookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/** Same pending-2FA state the two-factor plugin creates on credential sign-in:
 * a `2fa-*` verification record + signed `two_factor` cookie. */
async function createPendingTwoFactorChallenge(ctx: AuthHookContext, userId: string) {
  const cookie = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE_NAME, {
    maxAge: PENDING_CHALLENGE_MAX_AGE_SEC,
  });
  const identifier = `2fa-${generateRandomString(20)}`;
  await ctx.context.internalAdapter.createVerificationValue({
    value: userId,
    identifier,
    expiresAt: new Date(Date.now() + PENDING_CHALLENGE_MAX_AGE_SEC * 1000),
  });
  await ctx.setSignedCookie(cookie.name, identifier, ctx.context.secret, cookie.attributes);
}

/** Mirrors the two-factor plugin's trust-device check: HMAC-verify the cookie, confirm
 * the verification record, and rotate the identifier on success. */
async function isTrustedDeviceForUser(ctx: AuthHookContext, userId: string): Promise<boolean> {
  const attrs = ctx.context.createAuthCookie(TRUST_DEVICE_COOKIE_NAME, {
    maxAge: TRUST_DEVICE_MAX_AGE_SEC,
  });
  const cookieValue = await ctx.getSignedCookie(attrs.name, ctx.context.secret);
  if (!cookieValue) return false;
  const [token, trustIdentifier] = cookieValue.split("!");
  if (!token || !trustIdentifier) {
    expireCookie(ctx, attrs);
    return false;
  }
  const expected = await createHMAC("SHA-256", "base64urlnopad").sign(
    ctx.context.secret,
    `${userId}!${trustIdentifier}`,
  );
  if (token !== expected) {
    expireCookie(ctx, attrs);
    return false;
  }
  const record = await ctx.context.internalAdapter.findVerificationValue(trustIdentifier);
  if (!record || record.value !== userId || record.expiresAt <= new Date()) {
    expireCookie(ctx, attrs);
    return false;
  }
  // Rotate the trust identifier, matching the credential sign-in hook.
  await ctx.context.internalAdapter.deleteVerificationByIdentifier(trustIdentifier);
  const newIdentifier = `trust-device-${generateRandomString(32)}`;
  const newToken = await createHMAC("SHA-256", "base64urlnopad").sign(
    ctx.context.secret,
    `${userId}!${newIdentifier}`,
  );
  await ctx.context.internalAdapter.createVerificationValue({
    value: userId,
    identifier: newIdentifier,
    expiresAt: new Date(Date.now() + TRUST_DEVICE_MAX_AGE_SEC * 1000),
  });
  await ctx.setSignedCookie(attrs.name, `${newToken}!${newIdentifier}`, ctx.context.secret, {
    ...attrs.attributes,
  });
  return true;
}

export function buildTwoFactorEnforcementAfterHook(options: { authOrigin?: string | undefined }) {
  const authOrigin = options.authOrigin ?? "https://auth.lax.bid";

  return {
    matcher: (context: { path?: string }) => !isTwoFactorExemptPath(context.path ?? ""),
    handler: createAuthMiddleware(async (ctx) => {
      const data = ctx.context.newSession;
      if (!data) return;
      const user = data.user as AuthUser | undefined;
      const callbackURL =
        typeof (ctx.query as Record<string, unknown> | undefined)?.callbackURL === "string"
          ? ((ctx.query as Record<string, string>).callbackURL as string)
          : null;
      await enforceTwoFactorOnNewSession({
        user,
        sessionToken: data.session?.token,
        challengeUrl: buildTwoFactorChallengeUrl(authOrigin, callbackURL),
        isTrustedDevice: () =>
          user ? isTrustedDeviceForUser(ctx, user.id) : Promise.resolve(false),
        deleteSession: (token) => ctx.context.internalAdapter.deleteSession(token),
        deleteCookie: () => deleteSessionCookie(ctx, true),
        createPendingChallenge: () =>
          user ? createPendingTwoFactorChallenge(ctx, user.id) : Promise.resolve(),
        redirect: (url) => {
          throw ctx.redirect(url);
        },
      });
    }),
  };
}

/** Cross-cutting guard: any endpoint that creates a session (magic-link verify,
 * email-verification auto-sign-in, future sign-in methods) hands 2FA users off to
 * the TOTP challenge, except the exempt paths above.
 */
export function buildTwoFactorEnforcementPlugin(options: {
  authOrigin?: string | undefined;
}): BetterAuthPlugin {
  return {
    id: "two-factor-enforcement",
    hooks: {
      after: [buildTwoFactorEnforcementAfterHook(options)],
    },
  };
}
