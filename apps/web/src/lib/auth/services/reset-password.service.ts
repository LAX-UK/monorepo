import { apiBaseUrl } from "@/lib/auth/api-base";
import { authSubmitFailure } from "@/lib/auth/auth-error-code";
import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";

export type ResetPasswordInput = {
  token: string;
  newPassword: string;
};

export interface IResetPasswordService {
  submit(input: ResetPasswordInput): Promise<AuthSubmitResult>;
}

/** Better Auth reset failures carry a `code` (e.g. INVALID_TOKEN); token problems get
 * their own copy so users know to request a fresh link instead of retrying. */
async function mapResetFailure(res: Response): Promise<AuthSubmitResult> {
  let raw = "";
  try {
    const body = (await res.clone().json()) as { code?: unknown; message?: unknown };
    raw = `${typeof body.code === "string" ? body.code : ""} ${
      typeof body.message === "string" ? body.message : ""
    }`.toUpperCase();
  } catch {
    // Non-JSON error body: fall through to the generic failure.
  }
  if (raw.includes("TOKEN")) {
    return authSubmitFailure("reset_token_invalid");
  }
  return authSubmitFailure("reset_password_failed");
}

class ResetPasswordService implements IResetPasswordService {
  async submit(input: ResetPasswordInput): Promise<AuthSubmitResult> {
    const authBaseUrl = process.env.NEXT_PUBLIC_AUTH_URL?.replace(/\/$/, "") ?? apiBaseUrl();
    const res = await fetch(`${authBaseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: input.token,
        newPassword: input.newPassword,
      }),
    });

    if (!res.ok) {
      return mapResetFailure(res);
    }

    return { ok: true };
  }
}

export const resetPasswordService = new ResetPasswordService();
