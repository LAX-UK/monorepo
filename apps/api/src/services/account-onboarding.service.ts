import type { IAccountOnboardingRepository } from "@auction/persistence/interfaces";
import {
  BID_TERMS_VERSION,
  type SignupPersona,
  isAccountOnboardingComplete,
} from "@auction/validators";
import { isOrgModuleEnabled, orgModuleDisabledResponse } from "../lib/org-module-enabled.js";
import { acceptInviteForOnboarding } from "./account-onboarding-invite.js";
import type { IInvitationConsumption } from "./invitation-consumption.service.js";

export type AccountOnboardingInput = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  persona: SignupPersona;
  inviteToken?: string | undefined;
  mobile?: string | undefined;
  mobileCountry?: string | undefined;
  webOrigin: string;
};

export class AccountOnboardingService {
  constructor(
    private readonly onboardingRepo: IAccountOnboardingRepository,
    private readonly invitations: IInvitationConsumption,
  ) {}

  async getStatus(userId: string): Promise<{ complete: boolean }> {
    const row = await this.onboardingRepo.getStatus(userId);
    return {
      complete: isAccountOnboardingComplete({
        termsAcceptedAt: row?.termsAcceptedAt ?? null,
      }),
    };
  }

  async complete(
    input: AccountOnboardingInput,
  ): Promise<{ ok: true } | { ok: false; status: number; message: string; code?: string }> {
    const existing = await this.getStatus(input.userId);
    if (existing.complete) {
      return {
        ok: false,
        status: 409,
        message: "Account onboarding is already complete",
        code: "already_complete",
      };
    }

    const orgModuleEnabled = isOrgModuleEnabled(input.webOrigin);
    if (!orgModuleEnabled && input.persona === "organisation") {
      const disabled = orgModuleDisabledResponse();
      return { ok: false, status: 403, message: disabled.error, code: disabled.code };
    }

    const inviteResult = await acceptInviteForOnboarding({
      inviteToken: input.inviteToken,
      email: input.email,
      userId: input.userId,
      invitations: this.invitations,
      webOrigin: input.webOrigin,
    });
    if (!inviteResult.ok) {
      return inviteResult;
    }

    const now = new Date();
    await this.onboardingRepo.completeOnboarding({
      userId: input.userId,
      firstName: input.firstName,
      lastName: input.lastName,
      persona: input.persona,
      termsAcceptedAt: now,
      termsVersion: BID_TERMS_VERSION,
      ...(input.mobile !== undefined
        ? {
            mobile: input.mobile,
            ...(input.mobileCountry !== undefined ? { mobileCountry: input.mobileCountry } : {}),
          }
        : {}),
    });

    return { ok: true };
  }
}
