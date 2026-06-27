import twilio, { type Twilio } from "twilio";

export type TwilioVerifyEnv = {
  TWILIO_ACCOUNT_SID?: string | undefined;
  TWILIO_VERIFY_SERVICE_SID?: string | undefined;
  TWILIO_API_KEY_SID?: string | undefined;
  TWILIO_API_KEY_SECRET?: string | undefined;
  TWILIO_AUTH_TOKEN?: string | undefined;
};

export function createTwilioClient(env: TwilioVerifyEnv): Twilio | null {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim();
  const serviceSid = env.TWILIO_VERIFY_SERVICE_SID?.trim();
  if (!accountSid || !serviceSid) return null;

  const apiKeySid = env.TWILIO_API_KEY_SID?.trim();
  const apiKeySecret = env.TWILIO_API_KEY_SECRET?.trim();
  const authToken = env.TWILIO_AUTH_TOKEN?.trim();

  if (apiKeySid && apiKeySecret) {
    return twilio(apiKeySid, apiKeySecret, {
      accountSid,
      autoRetry: true,
      maxRetries: 2,
    });
  }

  if (authToken) {
    return twilio(accountSid, authToken, {
      autoRetry: true,
      maxRetries: 2,
    });
  }

  return null;
}

export function isTwilioVerifyConfigured(env: TwilioVerifyEnv): boolean {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim();
  const serviceSid = env.TWILIO_VERIFY_SERVICE_SID?.trim();
  if (!accountSid || !serviceSid) return false;

  const hasApiKey =
    Boolean(env.TWILIO_API_KEY_SID?.trim()) && Boolean(env.TWILIO_API_KEY_SECRET?.trim());
  const hasAuthToken = Boolean(env.TWILIO_AUTH_TOKEN?.trim());
  return hasApiKey || hasAuthToken;
}
