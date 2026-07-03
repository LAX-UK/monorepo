import { describe, expect, it, vi } from "vitest";
import type { ILegalEntityOnboardingRepository } from "../repositories/interfaces/legal-entity-onboarding.repository.js";
import { OrganizationOnboardingService } from "./organization-onboarding.service.js";

describe("OrganizationOnboardingService", () => {
  it("checkNameAvailability ignores organisation kind filter", async () => {
    const onboardingRepo = {
      existsOrganisationSlug: vi.fn().mockResolvedValue(false),
    } as unknown as ILegalEntityOnboardingRepository;
    const service = new OrganizationOnboardingService(onboardingRepo);
    const result = await service.checkNameAvailability("Acme Gallery");
    expect(result.available).toBe(true);
  });

  it("createOrganization rejects when user exceeds org cap", async () => {
    const onboardingRepo = {
      countNonArchivedOrganisationsByCreator: vi.fn().mockResolvedValue(3),
    } as unknown as ILegalEntityOnboardingRepository;
    const service = new OrganizationOnboardingService(onboardingRepo);
    await expect(
      service.createOrganization("user-1", {
        displayName: "Fourth Org",
        subkind: "gallery",
      }),
    ).rejects.toThrow("organization_limit_reached");
  });
});
