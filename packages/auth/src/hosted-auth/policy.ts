/** Display-side constraints that must stay aligned with issuer password/email policy. */
export const HOSTED_AUTH_POLICY = {
  passwordMinLength: 12,
  passwordMaxLength: 128,
  otpLength: 6,
  otpMaxLength: 8,
  magicLinkCooldownMs: 30_000,
  magicLinkExpiresMinutes: 15,
} as const;

export const HOSTED_AUTH_ASSET_VERSION = "20260917a";
