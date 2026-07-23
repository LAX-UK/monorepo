"use client";

import { AdminFilterDraftInput } from "@/components/admin/filters/admin-filter-draft-fields";
import { AdminFilterSheetFields } from "@/components/admin/filters/admin-filter-section";
import { useAdminFilterDraftContext } from "@/components/admin/filters/admin-filter-sheet-root";
import type { PayoutsFilterDraft } from "@/lib/admin/filters/payouts-filter-adapter";

export function AdminPayoutsFilterFields() {
  const { draft, patch } = useAdminFilterDraftContext<PayoutsFilterDraft>();

  return (
    <AdminFilterSheetFields>
      <AdminFilterDraftInput
        id="admin-payouts-filter-legal-entity-id"
        label="Legal entity ID"
        type="text"
        value={draft.legalEntityId}
        onChange={(legalEntityId) => patch({ legalEntityId })}
        placeholder="Optional UUID"
      />
    </AdminFilterSheetFields>
  );
}
