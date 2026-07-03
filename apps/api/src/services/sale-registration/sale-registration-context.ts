import type { Database } from "@auction/db";
import type { ISaleRegistrationRepository } from "../../repositories/interfaces/sale-registration.repository.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { ISaleRepository } from "../interfaces/repositories.js";

export type SaleRegistrationContext = {
  db: Database;
  registrationRepo: ISaleRegistrationRepository;
  saleRepo: ISaleRepository;
  legalEntityRepository: ILegalEntityRepository;
};

export function createSaleRegistrationContext(input: {
  db: Database;
  registrationRepo: ISaleRegistrationRepository;
  saleRepo: ISaleRepository;
  legalEntityRepository: ILegalEntityRepository;
}): SaleRegistrationContext {
  return { ...input };
}
