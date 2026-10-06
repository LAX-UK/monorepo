import { readFileSync } from "node:fs";

function readProvisionedTotpSecret(): string | undefined {
  const fromEnv =
    process.env.SHOP_ACCEPTANCE_PROVISIONED_TOTP_SECRET?.trim() ||
    process.env.SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET?.trim();
  if (fromEnv) return fromEnv;
  const path = process.env.SHOP_ACCEPTANCE_STAFF_TOTP_FILE?.trim();
  if (!path) return undefined;
  try {
    const secret = readFileSync(path, "utf8").trim();
    return secret || undefined;
  } catch {
    return undefined;
  }
}

export function requireStaffAcceptanceCredentials(): {
  email: string;
  password: string;
  totpSecret?: string;
} {
  const email = process.env.SHOP_ADMIN_ACCEPTANCE_EMAIL?.trim() ?? "";
  const password = process.env.SHOP_ADMIN_ACCEPTANCE_PASSWORD?.trim() ?? "";
  if (!email || !password) {
    throw new Error("SHOP_ADMIN_ACCEPTANCE_EMAIL and SHOP_ADMIN_ACCEPTANCE_PASSWORD are required");
  }
  const totpSecret = readProvisionedTotpSecret();
  return { email, password, ...(totpSecret ? { totpSecret } : {}) };
}
