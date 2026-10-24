/** Display-side constraints that must stay aligned with issuer password/email policy. */
export const HOSTED_AUTH_POLICY = {
  passwordMinLength: 12,
  passwordMaxLength: 128,
  otpLength: 6,
  otpMaxLength: 8,
  magicLinkCooldownMs: 30_000,
  magicLinkExpiresMinutes: 15,
} as const;

/**
 * Cache key for every hosted asset (CSS, runtime, lockups, fonts), which browsers and the CDN keep
 * for an hour. Change it whenever any of those files changes, or people keep the old one.
 */
export const HOSTED_AUTH_ASSET_VERSION = "20261024a";
