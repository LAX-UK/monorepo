import type { LotAttentionContributor } from "./lot-attention-contributor.js";
import type {
  LotAttentionPrincipal,
  LotAttentionResult,
  LotAttentionSignals,
} from "./lot-attention-types.js";
import { LOT_ATTENTION_SEVERITY_RANK } from "./lot-attention-types.js";

const DEFAULT_LIMIT = 50;

export type ComposeLotAttentionOptions = {
  limit?: number;
  principal: LotAttentionPrincipal;
};

export function resolveApplicableContributors(
  status: string,
  contributors: readonly LotAttentionContributor[],
): LotAttentionContributor[] {
  return contributors.filter((c) => c.appliesTo(status));
}

export function composeLotAttention(
  signals: LotAttentionSignals,
  contributors: readonly LotAttentionContributor[],
  options: ComposeLotAttentionOptions,
): LotAttentionResult {
  const lot = signals.lot;
  if (!lot) {
    return { items: [], totalCount: 0, truncated: false };
  }

  const applicable = resolveApplicableContributors(lot.status, contributors);
  const allItems = applicable.flatMap((contributor) => contributor.evaluate(signals));

  const sorted = [...allItems].sort((a, b) => {
    const sev = LOT_ATTENTION_SEVERITY_RANK[a.severity] - LOT_ATTENTION_SEVERITY_RANK[b.severity];
    if (sev !== 0) return sev;
    return b.count - a.count;
  });

  const limit = options.limit ?? DEFAULT_LIMIT;
  const totalCount = sorted.length;
  const truncated = totalCount > limit;

  return {
    items: sorted.slice(0, limit),
    totalCount,
    truncated,
  };
}
