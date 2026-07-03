import type { Database } from "@auction/db";
import type { legalEntity } from "@auction/db/schema";
import type { LegalEntityStatus, OrgOnboardingStepKey } from "@auction/types";
import type { PublicOrganisationSubkind } from "@auction/validators";
import type { OrganizationOnboardingProfileInput } from "../lib/org-onboarding-mappers.js";

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

export type CreateOrganisationAttemptInput = {
  creatorUserId: string;
  displayName: string;
  legalName: string | null;
  subkind: PublicOrganisationSubkind;
  vatNumber: string | null;
  slug: string;
  primaryAddress?: OrganizationOnboardingProfileInput["primaryAddress"] | undefined;
};

export type AttachOnboardingDocumentInput = {
  legalEntityId: string;
  uploadObjectId: string;
  kind: string;
  label: string | null;
  uploadedByUserId: string;
};

export interface ILegalEntityOnboardingRepository {
  transaction<T>(fn: (db: OnboardingDbExecutor) => Promise<T>): Promise<T>;

  countNonArchivedOrganisationsByCreator(userId: string): Promise<number>;

  existsOrganisationSlug(slug: string, db?: OnboardingDbExecutor): Promise<boolean>;

  listOrganisationSlugSuffixes(baseSlug: string): Promise<string[]>;

  createOrganisationAttempt(
    input: CreateOrganisationAttemptInput,
    db?: OnboardingDbExecutor,
  ): Promise<OnboardingOrganisationRow>;

  findOrganisationById(entityId: string): Promise<OnboardingOrganisationRow | null>;

  listCompletedStepKeys(entityId: string): Promise<string[]>;

  listDocuments(entityId: string): Promise<OnboardingDocumentRow[]>;

  findDocumentByUploadObjectId(
    entityId: string,
    uploadObjectId: string,
  ): Promise<{ id: string } | null>;

  attachOnboardingDocument(input: AttachOnboardingDocumentInput): Promise<{ id: string }>;

  findOnboardingDocumentById(entityId: string, documentId: string): Promise<{ id: string } | null>;

  detachOnboardingDocument(documentId: string): Promise<void>;

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
