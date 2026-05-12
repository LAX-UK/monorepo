export type AuthSubmitResult =
  | {
      ok: true;
      /** When Better Auth requires a second factor after email/password. */
      requiresTwoFactor?: boolean;
      twoFactorMethods?: string[];
      code?: string;
    }
  | { ok: false; message: string; code?: string };
