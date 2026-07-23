"use client";

import { AdminFilterDraftSelect } from "@/components/admin/filters/admin-filter-draft-fields";
import { AdminFilterSheetFields } from "@/components/admin/filters/admin-filter-section";
import { useAdminFilterDraftContext } from "@/components/admin/filters/admin-filter-sheet-root";
import type { InvitationsFilterDraft } from "@/lib/admin/filters/invitations-filter-adapter";
import { invitationStatusFilterOptions } from "@/lib/admin/invitations-list-query";

export function AdminInvitationsFilterFields() {
  const { draft, patch } = useAdminFilterDraftContext<InvitationsFilterDraft>();

  return (
    <AdminFilterSheetFields>
      <AdminFilterDraftSelect
        id="admin-invitations-filter-status"
        label="Status"
        value={draft.status}
        onChange={(status) => patch({ status })}
        options={[{ value: "", label: "All statuses" }, ...invitationStatusFilterOptions]}
      />
    </AdminFilterSheetFields>
  );
}
