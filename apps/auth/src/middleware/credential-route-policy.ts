import { AUTH_ROUTE_PATH } from "@auction/identity-contracts";

/**
 * Primary login credential endpoints that must be same-origin only (hosted issuer UI).
 * Account-management routes (2FA enrol/verify, phone OTP for profile) are excluded.
 */
export function isPrimaryLoginCredentialPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "");
  if (!path.startsWith(`${AUTH_ROUTE_PATH}/`)) return false;
  if (path.includes("/sign-in/")) return true;
  if (path.includes("/sign-up/")) return true;
  if (path.endsWith("/reset-password")) return true;
  if (path.endsWith("/request-password-reset")) return true;
  if (path.includes("/magic-link/")) return true;
  if (path.endsWith("/phone-number/sign-in")) return true;
  return false;
}
