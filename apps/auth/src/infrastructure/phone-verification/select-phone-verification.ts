import type { SmsSender } from "@auction/auth";
import type { AuthAppEnv } from "../../env.js";
import { ConsolePhoneVerificationService } from "./console.service.js";
import type { TwilioVerifyEnv } from "./twilio-verify-client.js";
import { TwilioVerifyService, isTwilioVerifyConfigured } from "./twilio-verify.service.js";
import { UnconfiguredPhoneVerificationService } from "./unconfigured.service.js";

type PhoneVerificationEnv = Pick<AuthAppEnv, "NODE_ENV" | "ENABLE_PHONE_VERIFICATION"> &
  TwilioVerifyEnv;

/**
 * Real delivery when it is switched on and set up; the local stand-in only in development and
 * test; anywhere else a provider that reports itself as not configured.
 */
export function selectPhoneVerification(env: PhoneVerificationEnv): SmsSender {
  if (env.ENABLE_PHONE_VERIFICATION && isTwilioVerifyConfigured(env)) {
    return TwilioVerifyService.fromEnv(env);
  }
  const localOnly = env.NODE_ENV === "development" || env.NODE_ENV === "test";
  return localOnly
    ? new ConsolePhoneVerificationService()
    : new UnconfiguredPhoneVerificationService();
}
