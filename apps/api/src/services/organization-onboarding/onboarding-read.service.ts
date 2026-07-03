import { ORG_ONBOARDING_STEPS, type OrgOnboardingStepKey } from "@auction/types";
import type { IOnboardingReadService } from "./onboarding-context.js";
import type { OnboardingContext } from "./onboarding-context.js";
import { rowToEntity } from "./org-onboarding-mappers.js";

export class OnboardingReadService implements IOnboardingReadService {
  constructor(private readonly ctx: OnboardingContext) {}

  async getOnboarding(userId: string, entityId: string) {
    const membership = await this.ctx.legalEntityRepository.findActiveMembership(userId, entityId);
    if (!membership) return null;

    const row = await this.ctx.onboardingRepo.findOrganisationById(entityId);
    if (!row || row.kind !== "organisation") return null;

    const progressRows = await this.ctx.onboardingRepo.listCompletedStepKeys(entityId);
    const completedSteps = progressRows
      .map((k) => k as OrgOnboardingStepKey)
      .filter((k) => (ORG_ONBOARDING_STEPS as readonly string[]).includes(k));

    const docRows = await this.ctx.onboardingRepo.listDocuments(entityId);
    const addr = await this.ctx.onboardingRepo.findRegisteredOfficeAddress(entityId);

    return {
      entity: rowToEntity(row),
      completedSteps,
      documents: docRows,
      primaryAddress: addr
        ? {
            addressType: "registered_office" as const,
            line1: addr.line1,
            line2: addr.line2 ?? null,
            city: addr.city,
            state: addr.state ?? null,
            postalCode: addr.postalCode,
            country: addr.country,
            isDefault: addr.isDefault ?? true,
          }
        : null,
    };
  }
}
