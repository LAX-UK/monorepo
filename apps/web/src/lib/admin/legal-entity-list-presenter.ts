import { statusLabel, subkindLabel } from "@/lib/organisations/legal-entity-labels";
import type { LegalEntityKind, LegalEntityStatus } from "@auction/types";
import { legalEntityKinds, legalEntityStatuses } from "@auction/types";

export { statusLabel, subkindLabel };

const KIND_LABELS: Record<LegalEntityKind, string> = {
  individual: "Individual",
  organisation: "Organisation",
};

export function kindLabel(kind: LegalEntityKind | string): string {
  if (kind in KIND_LABELS) {
    return KIND_LABELS[kind as LegalEntityKind];
  }
  return kind.replace(/_/g, " ");
}

export function legalEntityStatusFilterOptions(): { value: string; label: string }[] {
  return legalEntityStatuses.map((status) => ({
    value: status,
    label: statusLabel(status),
  }));
}

export function legalEntityKindFilterOptions(): { value: string; label: string }[] {
  return legalEntityKinds.map((kind) => ({
    value: kind,
    label: kindLabel(kind),
  }));
}

export function stripeSummaryLabel(stripeDueCount: number): string {
  if (stripeDueCount > 0) {
    return `${stripeDueCount} requirement${stripeDueCount === 1 ? "" : "s"} due`;
  }
  return "No requirements due";
}

export function formatLegalEntityKindSubkind(
  kind: LegalEntityKind | string,
  subkind: string,
): string {
  return `${kindLabel(kind)} · ${subkindLabel(subkind)}`;
}

export type { LegalEntityKind, LegalEntityStatus };
