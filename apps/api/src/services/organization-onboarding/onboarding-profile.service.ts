import type { LegalEntityStatus } from "@auction/types";
import type { IOnboardingProfileService } from "./onboarding-context.js";
import type { OnboardingContext } from "./onboarding-context.js";
import {
  type OrganizationOnboardingProfileInput,
  assertEditableStatus,
  isOwnerOrAdmin,
} from "./org-onboarding-mappers.js";

export class OnboardingProfileService implements IOnboardingProfileService {
  constructor(private readonly ctx: OnboardingContext) {}

  async updateProfile(
    userId: string,
    entityId: string,
    input: OrganizationOnboardingProfileInput,
  ): Promise<
    { ok: true } | { ok: false; code: "not_found" | "forbidden" | "entity_not_editable" }
  > {
    const membership = await this.ctx.legalEntityRepository.findActiveMembership(userId, entityId);
    if (!membership) return { ok: false, code: "forbidden" };
    if (!isOwnerOrAdmin(membership.role)) return { ok: false, code: "forbidden" };

    const row = await this.ctx.onboardingRepo.findOrganisationById(entityId);
    if (!row || row.kind !== "organisation") return { ok: false, code: "not_found" };
    if (!assertEditableStatus(row.status as LegalEntityStatus)) {
      return { ok: false, code: "entity_not_editable" };
    }

    await this.ctx.onboardingRepo.updateProfileWithAddress(
      entityId,
      {
        displayName: input.displayName,
        legalName: input.legalName?.trim() ? input.legalName.trim() : null,
        vatNumber: input.vatNumber?.trim() ? input.vatNumber.trim() : null,
      },
      input.primaryAddress,
    );

    return { ok: true };
  }
}
