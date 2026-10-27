import { resolveApplicableContributors } from "./active-signal-keys.js";
import type { SaleAttentionContributor } from "./sale-attention-contributor.js";
import type {
  SaleAttentionItem,
  SaleAttentionKind,
  SaleAttentionPrincipal,
  SaleAttentionResult,
  SaleAttentionSignals,
} from "./sale-attention-types.js";
import { SALE_ATTENTION_SEVERITY_RANK } from "./sale-attention-types.js";

const DEFAULT_LIMIT = 50;

/** Kinds that legitimately appear several times, each with its own title (one per check or blocker). */
const REPEATABLE_KINDS: ReadonlySet<SaleAttentionKind> = new Set([
  "setup_readiness",
  "delete_blocker",
]);

/**
 * Two contributors can report the same condition (the setup check and the catalogue check both
 * see draft lots without photos). The first item of a kind in severity order is kept.
 */
function dropRepeatedKinds(sorted: readonly SaleAttentionItem[]): SaleAttentionItem[] {
  const seen = new Set<SaleAttentionKind>();
  return sorted.filter((item) => {
    if (REPEATABLE_KINDS.has(item.kind)) return true;
    if (seen.has(item.kind)) return false;
    seen.add(item.kind);
    return true;
  });
}

export type ComposeSaleAttentionOptions = {
  limit?: number;
  principal: SaleAttentionPrincipal;
};

export function composeSaleAttention(
  signals: SaleAttentionSignals,
  contributors: readonly SaleAttentionContributor[],
  options: ComposeSaleAttentionOptions,
): SaleAttentionResult {
  const sale = signals.sale;
  if (!sale) {
    return { items: [], totalCount: 0, truncated: false };
  }

  const applicable = resolveApplicableContributors(sale.status, contributors, options.principal);
  const allItems = applicable.flatMap((contributor) => contributor.evaluate(signals));

  const sorted = dropRepeatedKinds(
    [...allItems].sort((a, b) => {
      const sev =
        SALE_ATTENTION_SEVERITY_RANK[a.severity] - SALE_ATTENTION_SEVERITY_RANK[b.severity];
      if (sev !== 0) return sev;
      return b.count - a.count;
    }),
  );

  const limit = options.limit ?? DEFAULT_LIMIT;
  const totalCount = sorted.length;
  const truncated = totalCount > limit;

  return {
    items: sorted.slice(0, limit),
    totalCount,
    truncated,
  };
}
