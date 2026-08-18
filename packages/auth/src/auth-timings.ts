/** Central auth timing policy (seconds unless noted). */
export const AUTH_TIMINGS = {
  /** Email verification link validity */
  emailVerificationExpiresSec: 60 * 60 * 24,
  /** Password reset link validity (must match template copy / UX) */
  resetPasswordExpiresSec: 60 * 60,
  /** Magic-link activation / passwordless sign-in token validity */
  magicLinkExpiresSec: 15 * 60,
  /** OIDC refresh token lifetime (seconds). Rotation + reuse detection are enforced by Better Auth OIDC plugin (single-use refresh). */
  oidcRefreshTokenExpiresSec: 60 * 60 * 24 * 30,
  /** DB-backed Better Auth session cookie lifetime */
  sessionExpiresSec: 60 * 60 * 24 * 7,
  /** Rolling session refresh interval (Better Auth `session.updateAge`) */
  sessionUpdateAgeSec: 60 * 60 * 24,
  /** Step-up / sensitive actions: max age since last password proof on this session */
  recentPasswordProofMaxAgeSec: 10 * 60,
} as const;

export {
  ACCESS_TOKEN_TTL_SECONDS,
  DEFAULT_JWT_AUDIENCE,
} from "@auction/identity-contracts";
