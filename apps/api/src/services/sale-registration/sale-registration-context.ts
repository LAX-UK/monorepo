import type { ISaleRegistrationRepository } from "@auction/persistence";
import type { ILegalEntityRepository } from "@auction/persistence";
import type { ISaleRepository } from "@auction/persistence";

export type SaleRegistrationContext = {
  registrationRepo: ISaleRegistrationRepository;
  saleRepo: ISaleRepository;
  legalEntityRepository: ILegalEntityRepository;
};

export function createSaleRegistrationContext(input: {
  registrationRepo: ISaleRegistrationRepository;
  saleRepo: ISaleRepository;
  legalEntityRepository: ILegalEntityRepository;
}): SaleRegistrationContext {
  return { ...input };
}
