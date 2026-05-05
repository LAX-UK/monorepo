import { apiBaseUrl } from "@/lib/auth/api-base";
import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";

export type ResetPasswordInput = {
  token: string;
  newPassword: string;
};

export interface IResetPasswordService {
  submit(input: ResetPasswordInput): Promise<AuthSubmitResult>;
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
      return { ok: false, message: "We could not reset your password. Please request a new link." };
    }

    return { ok: true };
  }
}

export const resetPasswordService = new ResetPasswordService();
