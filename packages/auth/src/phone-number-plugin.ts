import type { BetterAuthOptions } from "better-auth";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { phoneNumber } from "better-auth/plugins";
import {
  InvalidPhoneNumberError,
  PhoneVerificationRateLimitedError,
} from "./phone-number-errors.js";
import type { EmailSender } from "./ports/email-sender.js";
import type { PhoneNumberStore } from "./ports/phone-number-store.js";
import type { SmsSender } from "./ports/sms-sender.js";

function extractClientIp(headers: Headers | undefined): string | undefined {
  if (!headers) return undefined;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() ?? undefined;
}

export function buildPhoneNumberPlugin(options: {
  phoneNumberStore: PhoneNumberStore;
  phoneVerification?: SmsSender | undefined;
  email?: EmailSender | undefined;
}): ReturnType<typeof phoneNumber> {
  const { phoneNumberStore, phoneVerification, email } = options;

  return phoneNumber({
    requireVerification: true,
    sendOTP: async ({ phoneNumber: phoneE164 }, ctx) => {
      if (!phoneVerification?.isConfigured()) {
        throw new APIError("SERVICE_UNAVAILABLE", {
          message: "Phone verification is not configured",
        });
      }
      const ipAddress = extractClientIp(ctx?.request?.headers);
      try {
        await phoneVerification.sendOtp(phoneE164, { ipAddress });
        await phoneNumberStore.purgeExpiredVerifications();
      } catch (error) {
        if (error instanceof InvalidPhoneNumberError) {
          throw new APIError("BAD_REQUEST", { message: "Invalid phone number" });
        }
        if (error instanceof PhoneVerificationRateLimitedError) {
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Too many verification attempts. Try again shortly.",
          });
        }
        console.error("[auth.phoneNumber] sendOTP failed", {
          phoneE164,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new APIError("INTERNAL_SERVER_ERROR", {
          message: "Could not send verification code",
        });
      }
    },
    verifyOTP: async ({ phoneNumber: phoneE164, code }) => {
      if (!phoneVerification?.isConfigured()) {
        throw new APIError("SERVICE_UNAVAILABLE", {
          message: "Phone verification is not configured",
        });
      }
      try {
        const result = await phoneVerification.checkOtp(phoneE164, code);
        return result.valid;
      } catch (error) {
        if (error instanceof PhoneVerificationRateLimitedError) {
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Too many verification attempts. Try again shortly.",
          });
        }
        console.error("[auth.phoneNumber] verifyOTP failed", {
          phoneE164,
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    },
    callbackOnVerification: async ({ phoneNumber: phoneE164, user: authUser }) => {
      email
        ?.enqueue({
          template: "new-device-login",
          to: authUser.email,
          userId: authUser.id,
          category: "auth",
          vars: {
            userName: authUser.name,
            whenDisplay: new Date().toUTCString(),
            deviceSummary: `Phone number verified: ${phoneE164}`,
          },
        })
        .catch((err: unknown) => {
          console.error("[auth.phoneNumber] enqueue phone-verified notice failed", {
            userId: authUser.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
    },
  });
}

export function buildPhoneNumberRateLimitPlugin(): BetterAuthPlugin {
  return {
    id: "phone-number-rate-limit",
    rateLimit: [
      {
        pathMatcher: (path) => path === "/phone-number/send-otp",
        max: 5,
        window: 60,
      },
    ],
  } satisfies BetterAuthPlugin;
}

export function buildPhoneNumberGuardPlugin(phoneNumberStore: PhoneNumberStore): BetterAuthPlugin {
  return {
    id: "phone-number-guard",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === "/phone-number/verify",
          handler: createAuthMiddleware(async (ctx) => {
            await phoneNumberStore.purgeExpiredVerifications();
            return { context: ctx };
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}

export type AuthDatabase = NonNullable<BetterAuthOptions["database"]>;
