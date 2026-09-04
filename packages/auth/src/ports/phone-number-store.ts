export type PhoneNumberStore = {
  purgeExpiredVerifications(): Promise<void>;
  findPhoneNumber(userId: string): Promise<string | null>;
  resetPhoneVerifiedIfNumberChanged(
    userId: string,
    previousPhone: string | null | undefined,
    nextPhone: string | null | undefined,
  ): Promise<void>;
};
