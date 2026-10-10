import type { BreachedPasswordChecker } from "@auction/auth";
import { setupPasswordBodySchema } from "./setup-password.js";

export type NewPasswordPolicyViolation = "invalid_password_policy" | "password_breached";

/** Breach lookups fail open: an unavailable checker never blocks a password. */
export async function findNewPasswordPolicyViolation(
  password: string,
  breachedPasswordChecker?: BreachedPasswordChecker,
): Promise<NewPasswordPolicyViolation | null> {
  if (!setupPasswordBodySchema.safeParse({ password }).success) return "invalid_password_policy";
  if (!breachedPasswordChecker) return null;
  const result = await breachedPasswordChecker.checkPassword(password);
  return result.status === "breached" ? "password_breached" : null;
}
