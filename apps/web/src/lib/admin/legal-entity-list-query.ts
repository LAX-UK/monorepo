import { buildListHref, firstString } from "@/lib/admin/admin-list-params";
import type { CatalogActiveFilterChip } from "@/lib/admin/catalog/types";
import {
  kindLabel,
  legalEntityKindFilterOptions,
  legalEntityStatusFilterOptions,
  statusLabel,
} from "@/lib/admin/legal-entity-list-presenter";
import type { LegalEntityKind, LegalEntityStatus } from "@auction/types";
import { legalEntityKinds, legalEntityStatuses } from "@auction/types";

type SearchParams = Record<string, string | string[] | undefined>;

export type LegalEntityListFilters = {
  q?: string;
  status?: LegalEntityStatus;
  kind?: LegalEntityKind;
  /** View lens: Stripe requirements queue */
  stripeLens?: boolean;
};

function isLegalEntityStatus(s: string | undefined): s is LegalEntityStatus {
  return s != null && (legalEntityStatuses as readonly string[]).includes(s);
}

function isLegalEntityKind(s: string | undefined): s is LegalEntityKind {
  return s != null && (legalEntityKinds as readonly string[]).includes(s);
}

function omitParamsHref(basePath: string, sp: SearchParams, omit: readonly string[]): string {
  const patch: Record<string, string | null> = { offset: "0" };
  for (const key of omit) {
    patch[key] = null;
  }
  return buildListHref(basePath, sp, patch);
}

export function parseLegalEntityListFilters(sp: SearchParams): LegalEntityListFilters {
  const q = firstString(sp.q)?.trim();
  const statusRaw = firstString(sp.status);
  const kindRaw = firstString(sp.kind);
  const status = isLegalEntityStatus(statusRaw) ? statusRaw : undefined;
  const kind = isLegalEntityKind(kindRaw) ? kindRaw : undefined;
  const stripeLens = firstString(sp.stripe) === "1";

  return {
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(kind ? { kind } : {}),
    ...(stripeLens ? { stripeLens: true } : {}),
  };
}

export function countLegalEntityListActiveFilters(filters: LegalEntityListFilters): number {
  let n = 0;
  if (filters.q?.trim()) n += 1;
  if (filters.status) n += 1;
  if (filters.kind) n += 1;
  if (filters.stripeLens) n += 1;
  return n;
}

export function hasLegalEntityListActiveFilters(filters: LegalEntityListFilters): boolean {
  return countLegalEntityListActiveFilters(filters) > 0;
}

export function buildLegalEntityActiveFilterChips(
  basePath: string,
  sp: SearchParams,
  filters: LegalEntityListFilters,
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];

  if (filters.q?.trim()) {
    chips.push({
      id: "q",
      label: `Search: ${filters.q.trim()}`,
      clearHref: omitParamsHref(basePath, sp, ["q"]),
    });
  }
  if (filters.status) {
    chips.push({
      id: "status",
      label: `Status: ${statusLabel(filters.status)}`,
      clearHref: omitParamsHref(basePath, sp, ["status"]),
    });
  }
  if (filters.kind) {
    chips.push({
      id: "kind",
      label: `Kind: ${kindLabel(filters.kind)}`,
      clearHref: omitParamsHref(basePath, sp, ["kind"]),
    });
  }
  if (filters.stripeLens) {
    chips.push({
      id: "stripe",
      label: "Stripe requirements",
      clearHref: omitParamsHref(basePath, sp, ["stripe"]),
    });
  }

  return chips;
}

export { legalEntityKindFilterOptions, legalEntityStatusFilterOptions };
