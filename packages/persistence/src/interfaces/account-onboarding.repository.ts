import type { SignupPersona } from "@auction/validators";

export type AccountOnboardingStatusRow = {
  termsAcceptedAt: Date | null;
};

export type CompleteAccountOnboardingInput = {
  userId: string;
  firstName: string;
  lastName: string;
  persona: SignupPersona;
  termsAcceptedAt: Date;
  termsVersion: string;
  mobile?: string;
  mobileCountry?: string;
};

export interface IAccountOnboardingRepository {
  getStatus(userId: string): Promise<AccountOnboardingStatusRow | null>;
  completeOnboarding(input: CompleteAccountOnboardingInput): Promise<void>;
}
