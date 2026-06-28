import type { Database } from "@auction/db";
import { user, verification } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import type { IPhoneVerificationService } from "@auction/sms";
import { InvalidPhoneNumberError, PhoneVerificationRateLimitedError } from "@auction/sms";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { phoneNumber } from "better-auth/plugins";
import { eq, lt } from "drizzle-orm";
import { parsePhoneNumberFromString } from "libphonenumber-js";

function resolveCountryFromE164(phoneE164: string): string | null {
  const parsed = parsePhoneNumberFromString(phoneE164);
  return parsed?.country ?? null;
}

function extractClientIp(headers: Headers | undefined): string | undefined {
  if (!headers) return undefined;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() ?? undefined;
}

async function syncLegacyMobileFields(
  db: Database,
  userId: string,
  phoneE164: string,
): Promise<void> {
  const country = resolveCountryFromE164(phoneE164);
  await db
    .update(user)
    .set({
      mobile: phoneE164,
      ...(country ? { mobileCountry: country } : {}),
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));
}

async function purgeExpiredVerificationRows(db: Database): Promise<void> {
  const now = new Date();
  await db.delete(verification).where(lt(verification.expiresAt, now));
}

export function buildPhoneNumberPlugin(options: {
  db: Database;
  phoneVerification?: IPhoneVerificationService | undefined;
  email?: IEmailService | undefined;
}): ReturnType<typeof phoneNumber> {
  const { db, phoneVerification, email } = options;

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
        await purgeExpiredVerificationRows(db);
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
      try {
        await syncLegacyMobileFields(db, authUser.id, phoneE164);
      } catch (err) {
        console.error("[auth.phoneNumber] syncLegacyMobileFields failed", {
          userId: authUser.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }

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

export function buildPhoneNumberGuardPlugin(db: Database): BetterAuthPlugin {
  return {
    id: "phone-number-guard",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === "/phone-number/verify",
          handler: createAuthMiddleware(async (ctx) => {
            await purgeExpiredVerificationRows(db);
            return { context: ctx };
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}

export async function resetPhoneVerifiedIfNumberChanged(
  db: Database,
  userId: string,
  previousPhone: string | null | undefined,
  nextPhone: string | null | undefined,
): Promise<void> {
  const prev = previousPhone?.trim() ?? null;
  const next = nextPhone?.trim() ?? null;
  if (prev === next) return;
  if (next === null) {
    // Phone cleared: reset verified flag and clear legacy display fields.
    await db
      .update(user)
      .set({ phoneNumberVerified: false, mobile: null, mobileCountry: null, updatedAt: new Date() })
      .where(eq(user.id, userId));
  } else {
    // Phone changed to a different number: reset verified flag.
    await db
      .update(user)
      .set({ phoneNumberVerified: false, updatedAt: new Date() })
      .where(eq(user.id, userId));
  }
}
