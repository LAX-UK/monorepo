import type { AuthErrorCode } from "@/lib/auth/auth-error-code";

export type AuthSubmitResult =
  | {
      ok: true;
      /** When Better Auth requires a second factor after email/password. */
      requiresTwoFactor?: boolean;
      twoFactorMethods?: string[];
      /** Newsletter subscribe disposition (not an {@link AuthErrorCode}). */
      newsletterDisposition?: "subscribed" | "already_subscribed";
    }
  | { ok: false; code: AuthErrorCode; message: string };
