import { authClient } from "@/lib/auth-client";
import { authSubmitFailure, mapBetterAuthSecondaryFailure } from "@/lib/auth/auth-error-code";
import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";
import { buildVerifyEmailCallbackUrl } from "@/lib/auth/verify-email-callback-url";
import { buildVerifyEmailResendCallbackUrl } from "@/lib/auth/verify-email-resend-callback.server";

export type SendVerificationEmailInput = {
  email: string;
  callbackURL: string;
};

export async function sendVerificationEmailService(
  input: SendVerificationEmailInput,
): Promise<AuthSubmitResult> {
  try {
    const { error } = await authClient.sendVerificationEmail({
      email: input.email,
      callbackURL: input.callbackURL,
    });
    if (error) {
      const rawCode = "code" in error && typeof error.code === "string" ? error.code : undefined;
      const code = mapBetterAuthSecondaryFailure({
        rawCode,
        message: error.message,
        defaultCode: "verification_email_failed",
      });
      return authSubmitFailure(code);
    }
    return { ok: true };
  } catch {
    return authSubmitFailure("verification_email_failed");
  }
}

export type ResendVerificationEmailFromPendingInput = {
  email: string;
  next?: string | null;
  webOrigin?: string;
};

export async function resendVerificationEmailFromPending(
  input: ResendVerificationEmailFromPendingInput,
): Promise<AuthSubmitResult> {
  let callbackURL: string;
  try {
    callbackURL = await buildVerifyEmailResendCallbackUrl(
      input.email,
      input.next,
      input.webOrigin ?? (typeof window !== "undefined" ? window.location.origin : undefined),
    );
  } catch {
    return authSubmitFailure("verification_email_failed");
  }
  return sendVerificationEmailService({ email: input.email, callbackURL });
}

export type SendVerificationEmailFromBannerInput = {
  email: string;
  next: string;
};

export async function sendVerificationEmailFromBanner(
  input: SendVerificationEmailFromBannerInput,
): Promise<AuthSubmitResult> {
  let callbackURL: string;
  try {
    callbackURL = buildVerifyEmailCallbackUrl(input.email, input.next);
  } catch {
    return authSubmitFailure("verification_email_failed");
  }
  return sendVerificationEmailService({ email: input.email, callbackURL });
}
