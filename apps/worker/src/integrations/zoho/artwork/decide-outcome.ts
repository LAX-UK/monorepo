import {
  type ArtworkRegisterEntry,
  type FieldConflict,
  type RegisterField,
  reconcileZohoChange,
  registerFieldValue,
} from "@auction/artwork-register-contracts";
import type { ZohoArtworkSyncOutcomeKind } from "@auction/persistence/interfaces";
import type { ProductAssessment } from "./assess-product.js";

/** What the sync decided for one Product. */
export type ArtworkDecision = {
  outcome: ZohoArtworkSyncOutcomeKind;
  /** For a skip, the first reason it was skipped. */
  reason: string | null;
  /** The register fields that change, with the old and new values. Update and conflict only. */
  changes: Partial<Record<RegisterField, { from: unknown; to: unknown }>>;
  conflicts: FieldConflict[];
};

export type DecisionContext = {
  /** The record already holding this Zoho Product, if any. */
  existing: ArtworkRegisterEntry | null;
  /** The record already holding this Product's stock code, if any. */
  holderOfStockCode: ArtworkRegisterEntry | null;
};

const NO_CHANGES: ArtworkDecision["changes"] = {};

function skipped(reason: string): ArtworkDecision {
  return { outcome: "skipped", reason, changes: NO_CHANGES, conflicts: [] };
}

/**
 * Decides what a Product means for the register. Pure: the caller looks up the existing records
 * and carries the decision out (or, in a dry run, only reports it).
 *
 * New Products need a valid title, stock code and artist; an existing record is updated even when
 * Zoho is missing some of those. A stock code another record already holds is never reused.
 */
export function decideArtworkOutcome(
  assessment: ProductAssessment,
  context: DecisionContext,
): ArtworkDecision {
  if (assessment.blockers.includes("demo_artist")) return skipped("demo_artist");
  if (assessment.blockers.includes("invalid_modified_time")) {
    return skipped("invalid_modified_time");
  }

  const { existing } = context;
  if (!existing) {
    const blocker = assessment.blockers[0];
    if (blocker) return skipped(blocker);
    if (context.holderOfStockCode) return skipped("duplicate_stock_code");
    return { outcome: "create", reason: null, changes: NO_CHANGES, conflicts: [] };
  }

  if (!assessment.change) return skipped("invalid_modified_time");
  const result = reconcileZohoChange(existing, assessment.change);
  if (result.stale) return { outcome: "stale", reason: null, changes: NO_CHANGES, conflicts: [] };

  const changes: ArtworkDecision["changes"] = {};
  for (const field of Object.keys(result.apply) as (keyof typeof result.apply)[]) {
    changes[field] = { from: registerFieldValue(existing, field), to: result.apply[field] };
  }
  if (result.conflicts.length > 0) {
    return { outcome: "conflict", reason: null, changes, conflicts: result.conflicts };
  }
  if (Object.keys(changes).length === 0) {
    return { outcome: "unchanged", reason: null, changes, conflicts: [] };
  }
  return { outcome: "update", reason: null, changes, conflicts: [] };
}
