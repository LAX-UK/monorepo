import type { Database } from "@auction/db";
import type { legalEntity } from "@auction/db/schema";
import type { LegalEntityStatus, OrgOnboardingStepKey } from "@auction/types";
import type { OrganizationOnboardingProfileInput } from "../../services/organization-onboarding/org-onboarding-mappers.js";

export type OnboardingDbExecutor = Database;

export type OnboardingOrganisationRow = typeof legalEntity.$inferSelect;

export type OnboardingDocumentRow = {
  id: string;
  kind: string;
  label: string | null;
  reviewStatus: string;
};

export type OnboardingAddressRow = {
  addressType: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  isDefault: boolean | null;
};

export interface ILegalEntityOnboardingRepository {
  findOrganisationById(entityId: string): Promise<OnboardingOrganisationRow | null>;

  listCompletedStepKeys(entityId: string): Promise<string[]>;

  listDocuments(entityId: string): Promise<OnboardingDocumentRow[]>;

  findRegisteredOfficeAddress(entityId: string): Promise<OnboardingAddressRow | null>;

  hasRegisteredOfficeAddress(entityId: string): Promise<boolean>;

  updateProfileWithAddress(
    entityId: string,
    profile: {
      displayName: string;
      legalName: string | null;
      vatNumber: string | null;
    },
    address: OrganizationOnboardingProfileInput["primaryAddress"],
  ): Promise<void>;

  markStepComplete(entityId: string, step: OrgOnboardingStepKey): Promise<void>;

  findUserKycStatus(userId: string): Promise<string | null>;

  lockOrganisationForUpdate(
    entityId: string,
    db?: OnboardingDbExecutor,
  ): Promise<OnboardingOrganisationRow | null>;

  transitionOrganisationStatus(
    input: {
      entityId: string;
      userId: string;
      toStatus: LegalEntityStatus;
    },
    db?: OnboardingDbExecutor,
  ): Promise<void>;
}
