import type { ISaleRegistrationRepository } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { ISaleRepository } from "@auction/persistence/interfaces";

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
