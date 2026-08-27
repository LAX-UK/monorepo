export type SelfServiceIdentityIneligibilityCode = "email_not_verified" | "kyc_required";

export class SelfServiceIdentityEligibilityError extends Error {
  readonly status: number;
  readonly code: SelfServiceIdentityIneligibilityCode;

  constructor(message: string, status: number, code: SelfServiceIdentityIneligibilityCode) {
    super(message);
    this.name = "SelfServiceIdentityEligibilityError";
    this.status = status;
    this.code = code;
  }
}
