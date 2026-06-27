import { authClient } from "@/lib/auth-client";
import {
  authSubmitFailure,
  mapBetterAuthClientFailure,
  mapBetterAuthSecondaryFailure,
} from "@/lib/auth/auth-error-code";
import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";

function mapPhoneAuthError(message: string | undefined, rawCode?: string): AuthSubmitResult {
  const msg = (message ?? "").toLowerCase();
  if (msg.includes("invalid") && msg.includes("phone")) {
    return authSubmitFailure("registration_validation", {
      registrationDetail: "Enter a valid phone number.",
    });
  }
  if (
    msg.includes("invalid") ||
    msg.includes("incorrect") ||
    msg.includes("otp") ||
    msg.includes("expired")
  ) {
    return authSubmitFailure(
      mapBetterAuthSecondaryFailure({
        rawCode,
        message,
        defaultCode: "totp_invalid",
      }),
    );
  }
  return authSubmitFailure(
    mapBetterAuthClientFailure({
      rawCode,
      message,
    }),
  );
}

export async function sendPhoneOtpService(phoneE164: string): Promise<AuthSubmitResult> {
  const res = await authClient.phoneNumber.sendOtp({ phoneNumber: phoneE164 });
  if (res.error) {
    const rawCode =
      "code" in res.error && typeof res.error.code === "string" ? res.error.code : undefined;
    return mapPhoneAuthError(res.error.message, rawCode);
  }
  return { ok: true };
}

export async function verifyPhoneOtpService(input: {
  phoneE164: string;
  code: string;
  updatePhoneNumber?: boolean;
}): Promise<AuthSubmitResult> {
  const res = await authClient.phoneNumber.verify({
    phoneNumber: input.phoneE164,
    code: input.code,
    disableSession: true,
    updatePhoneNumber: input.updatePhoneNumber ?? false,
  });
  if (res.error) {
    const rawCode =
      "code" in res.error && typeof res.error.code === "string" ? res.error.code : undefined;
    return mapPhoneAuthError(res.error.message, rawCode);
  }
  return { ok: true };
}

export async function removePhoneNumberService(): Promise<AuthSubmitResult> {
  const res = await authClient.updateUser({ phoneNumber: null });
  if (res.error) {
    const rawCode =
      "code" in res.error && typeof res.error.code === "string" ? res.error.code : undefined;
    return mapPhoneAuthError(res.error.message, rawCode);
  }
  return { ok: true };
}

export async function signInWithPhoneService(input: {
  phoneE164: string;
  password: string;
  rememberMe?: boolean;
}): Promise<AuthSubmitResult> {
  const res = await authClient.signIn.phoneNumber({
    phoneNumber: input.phoneE164,
    password: input.password,
    rememberMe: input.rememberMe ?? true,
  });
  if (res.error) {
    const rawCode =
      "code" in res.error && typeof res.error.code === "string" ? res.error.code : undefined;
    const msg = res.error.message ?? "";
    if (msg.toLowerCase().includes("two-factor") || rawCode?.includes("TWO_FACTOR")) {
      return { ok: true, requiresTwoFactor: true };
    }
    if (rawCode === "PHONE_NUMBER_NOT_VERIFIED" || msg.includes("not verified")) {
      return {
        ok: false,
        code: "sign_in_failed" as const,
        message: "phone_number_not_verified",
      };
    }
    if (
      msg.toLowerCase().includes("password") ||
      rawCode?.includes("PASSWORD") ||
      rawCode?.includes("INVALID_PHONE_NUMBER_OR_PASSWORD")
    ) {
      return authSubmitFailure("invalid_credentials");
    }
    return mapPhoneAuthError(msg, rawCode);
  }
  if (res.data && typeof res.data === "object" && "twoFactorRedirect" in res.data) {
    const data = res.data as { twoFactorRedirect?: boolean; twoFactorMethods?: string[] };
    if (data.twoFactorRedirect) {
      return {
        ok: true,
        requiresTwoFactor: true,
        ...(data.twoFactorMethods ? { twoFactorMethods: data.twoFactorMethods } : {}),
      };
    }
  }
  return { ok: true };
}
