export type {
  SaleAttentionCategory,
  SaleAttentionItem,
  SaleAttentionKind,
  SaleAttentionLotSignal,
  SaleAttentionPrincipal,
  SaleAttentionRegistrationSignal,
  SaleAttentionResult,
  SaleAttentionSeverity,
  SaleAttentionSignalKey,
  SaleAttentionSignals,
  SaleAttentionTarget,
} from "./sale-attention-types.js";
export type { SaleAttentionContributor } from "./sale-attention-contributor.js";
export { composeSaleAttention } from "./compose-sale-attention.js";
export {
  resolveApplicableContributors,
  resolveNeededSignalKeys,
} from "./active-signal-keys.js";
export {
  DEFAULT_SALE_ATTENTION_CONTRIBUTORS,
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
} from "./sale-attention-registry.js";
