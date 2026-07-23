import { catalogContributor } from "./contributors/catalog.contributor.js";
import { conditionReportsContributor } from "./contributors/condition-reports.contributor.js";
import { connectContributor } from "./contributors/connect.contributor.js";
import { deleteBlockersContributor } from "./contributors/delete-blockers.contributor.js";
import { financeContributor } from "./contributors/finance.contributor.js";
import { fulfilmentContributor } from "./contributors/fulfilment.contributor.js";
import { registrationsContributor } from "./contributors/registrations.contributor.js";
import { returnToInventoryContributor } from "./contributors/return-to-inventory.contributor.js";
import { saleroomContributor } from "./contributors/saleroom.contributor.js";
import { settlementContributor } from "./contributors/settlement.contributor.js";
import { setupReadinessContributor } from "./contributors/setup-readiness.contributor.js";
import { telephoneContributor } from "./contributors/telephone.contributor.js";
import type { SaleAttentionContributor } from "./sale-attention-contributor.js";

export const DEFAULT_SALE_ATTENTION_CONTRIBUTORS: readonly SaleAttentionContributor[] = [
  setupReadinessContributor,
  deleteBlockersContributor,
  registrationsContributor,
  telephoneContributor,
  connectContributor,
  catalogContributor,
  settlementContributor,
  fulfilmentContributor,
  conditionReportsContributor,
  financeContributor,
  saleroomContributor,
  returnToInventoryContributor,
];

export {
  setupReadinessContributor,
  deleteBlockersContributor,
  registrationsContributor,
  telephoneContributor,
  connectContributor,
  catalogContributor,
  settlementContributor,
  fulfilmentContributor,
  conditionReportsContributor,
  financeContributor,
  saleroomContributor,
  returnToInventoryContributor,
};
