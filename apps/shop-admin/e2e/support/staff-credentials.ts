export function requireStaffAcceptanceCredentials(): {
  email: string;
  password: string;
  totpSecret?: string;
} {
  const email =
    process.env.SHOP_ADMIN_ACCEPTANCE_EMAIL?.trim() ||
    process.env.SHOP_OIDC_TEST_EMAIL?.trim() ||
    "";
  const password =
    process.env.SHOP_ADMIN_ACCEPTANCE_PASSWORD?.trim() ||
    process.env.SHOP_OIDC_TEST_PASSWORD?.trim() ||
    "";
  if (!email || !password) {
    throw new Error(
      "SHOP_ADMIN_ACCEPTANCE_EMAIL and SHOP_ADMIN_ACCEPTANCE_PASSWORD (or SHOP_OIDC_TEST_* fallbacks) are required",
    );
  }
  const totpSecret = process.env.SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET?.trim();
  return { email, password, ...(totpSecret ? { totpSecret } : {}) };
}
