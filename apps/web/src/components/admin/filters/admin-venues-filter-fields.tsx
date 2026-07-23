"use client";

import { AdminLegalEntityPicker } from "@/components/admin/admin-legal-entity-picker";
import {
  AdminFilterSection,
  AdminFilterSheetFields,
} from "@/components/admin/filters/admin-filter-section";
import { useAdminFilterDraftContext } from "@/components/admin/filters/admin-filter-sheet-root";
import type { VenuesFilterDraft } from "@/lib/admin/filters/venues-filter-adapter";

type Props = {
  legalEntityDisplayName?: string | null;
};

export function AdminVenuesFilterFields({ legalEntityDisplayName }: Props) {
  const { draft, patch } = useAdminFilterDraftContext<VenuesFilterDraft>();

  return (
    <AdminFilterSheetFields>
      <AdminFilterSection
        label="Organisation"
        description="Leave empty to show all venues across organisations."
      >
        <AdminLegalEntityPicker
          value={draft.legalEntityId || null}
          displayLabel={legalEntityDisplayName ?? null}
          onChange={(id) => patch({ legalEntityId: id ?? "" })}
          searchPlaceholder="Filter by organisation…"
        />
      </AdminFilterSection>
    </AdminFilterSheetFields>
  );
}
