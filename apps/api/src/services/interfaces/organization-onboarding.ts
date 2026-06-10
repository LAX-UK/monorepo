import type { LegalEntity } from "@auction/types";
import type { CreateOrganizationInput, PublicOrganisationSubkind } from "@auction/validators";

export type OrgOnboardingNextStep =
  | "kyc_individual"
  | "kyb_documents"
  | "stripe_connect"
  | "ready_to_consign";

export type CreateOrganizationResult = {
  entity: LegalEntity;
  /** Inferred personal-onboarding next steps for the creator. */
  nextSteps: OrgOnboardingNextStep[];
};

export type CheckNameResult = {
  available: boolean;
  /** When `available=false`, suggested alternative slugs/names. */
  suggestions: string[];
};

export type OrgRequirements = {
  subkind: PublicOrganisationSubkind;
  /** Document kinds we will *eventually* require for this subkind. */
  documentKinds: string[];
  /** Whether the org must complete Stripe Connect Express to receive payouts. */
  requiresStripeConnect: boolean;
  /** Whether VAT number is mandatory. */
  vatRequired: boolean;
};

export interface IOrganizationOnboardingService {
  createOrganization(
    creatorUserId: string,
    input: CreateOrganizationInput,
  ): Promise<CreateOrganizationResult>;
  checkNameAvailability(displayName: string): Promise<CheckNameResult>;
  getRequirements(subkind: PublicOrganisationSubkind): OrgRequirements;
  /** List public-facing subkinds for the dropdown. */
  listSubkinds(): { value: PublicOrganisationSubkind; label: string; description: string }[];
}
