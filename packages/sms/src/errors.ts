export class PhoneVerificationNotConfiguredError extends Error {
  constructor() {
    super("phone_verification_not_configured");
    this.name = "PhoneVerificationNotConfiguredError";
  }
}

export class InvalidPhoneNumberError extends Error {
  readonly phoneE164: string;

  constructor(phoneE164: string, message?: string) {
    super(message ?? "invalid_phone_number");
    this.name = "InvalidPhoneNumberError";
    this.phoneE164 = phoneE164;
  }
}

export class PhoneVerificationRateLimitedError extends Error {
  constructor(message?: string) {
    super(message ?? "phone_verification_rate_limited");
    this.name = "PhoneVerificationRateLimitedError";
  }
}
