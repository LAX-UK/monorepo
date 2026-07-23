"use client";

import { AdminFilterDraftSelect } from "@/components/admin/filters/admin-filter-draft-fields";
import { AdminFilterSheetFields } from "@/components/admin/filters/admin-filter-section";
import { useAdminFilterDraftContext } from "@/components/admin/filters/admin-filter-sheet-root";
import type { LegalEntitiesFilterDraft } from "@/lib/admin/filters/legal-entities-filter-adapter";
import {
  legalEntityKindFilterOptions,
  legalEntityStatusFilterOptions,
} from "@/lib/admin/legal-entity-list-presenter";

export function AdminLegalEntitiesFilterFields() {
  const { draft, patch } = useAdminFilterDraftContext<LegalEntitiesFilterDraft>();

  return (
    <AdminFilterSheetFields>
      <AdminFilterDraftSelect
        id="admin-legal-entities-filter-status"
        label="Status"
        value={draft.status}
        onChange={(status) => patch({ status })}
        options={[{ value: "", label: "Any status" }, ...legalEntityStatusFilterOptions()]}
      />
      <AdminFilterDraftSelect
        id="admin-legal-entities-filter-kind"
        label="Kind"
        value={draft.kind}
        onChange={(kind) => patch({ kind })}
        options={[{ value: "", label: "Any kind" }, ...legalEntityKindFilterOptions()]}
      />
    </AdminFilterSheetFields>
  );
}
