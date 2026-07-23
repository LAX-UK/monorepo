export type {
  LotAttentionItem,
  LotAttentionKind,
  LotAttentionPrincipal,
  LotAttentionResult,
  LotAttentionSeverity,
  LotAttentionSignals,
  LotAttentionTarget,
} from "./lot-attention-types.js";
export type { LotAttentionContributor } from "./lot-attention-contributor.js";
export { composeLotAttention, resolveApplicableContributors } from "./compose-lot-attention.js";
export {
  DEFAULT_LOT_ATTENTION_CONTRIBUTORS,
  setupReadinessContributor,
  connectContributor,
  missingPhotosContributor,
  withdrawalPendingContributor,
} from "./lot-attention-registry.js";
