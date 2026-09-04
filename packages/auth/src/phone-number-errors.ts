export class InvalidPhoneNumberError extends Error {
  constructor(phoneE164: string) {
    super(`Invalid phone number: ${phoneE164}`);
    this.name = "InvalidPhoneNumberError";
  }
}

export class PhoneVerificationRateLimitedError extends Error {
  constructor(message = "Phone verification rate limited") {
    super(message);
    this.name = "PhoneVerificationRateLimitedError";
  }
}
