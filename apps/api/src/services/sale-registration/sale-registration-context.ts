import type { IBidIdentityEligibilityGate } from "@auction/bidding-runtime";
import type { ISaleRegistrationRepository } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { ISaleRepository } from "@auction/persistence/interfaces";

export type SaleRegistrationContext = {
  registrationRepo: ISaleRegistrationRepository;
  saleRepo: ISaleRepository;
  legalEntityRepository: ILegalEntityRepository;
  identityEligibilityGate: IBidIdentityEligibilityGate | null;
};

export function createSaleRegistrationContext(input: {
  registrationRepo: ISaleRegistrationRepository;
  saleRepo: ISaleRepository;
  legalEntityRepository: ILegalEntityRepository;
  identityEligibilityGate?: IBidIdentityEligibilityGate | null;
}): SaleRegistrationContext {
  return { ...input, identityEligibilityGate: input.identityEligibilityGate ?? null };
}
