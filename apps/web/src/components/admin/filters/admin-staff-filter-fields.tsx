"use client";

import { AdminFilterDraftSelect } from "@/components/admin/filters/admin-filter-draft-fields";
import { AdminFilterSheetFields } from "@/components/admin/filters/admin-filter-section";
import { useAdminFilterDraftContext } from "@/components/admin/filters/admin-filter-sheet-root";
import type { StaffFilterDraft } from "@/lib/admin/filters/staff-filter-adapter";
import { staffRoleFilterOptions } from "@/lib/admin/staff-role-presenter";

export function AdminStaffFilterFields() {
  const { draft, patch } = useAdminFilterDraftContext<StaffFilterDraft>();

  return (
    <AdminFilterSheetFields>
      <AdminFilterDraftSelect
        id="admin-staff-filter-role"
        label="Staff role"
        value={draft.staffRole}
        onChange={(staffRole) => patch({ staffRole })}
        options={[{ value: "", label: "Any role" }, ...staffRoleFilterOptions]}
      />
      <AdminFilterDraftSelect
        id="admin-staff-filter-suspended"
        label="Status"
        value={draft.suspended}
        onChange={(suspended) => patch({ suspended })}
        options={[
          { value: "", label: "All staff" },
          { value: "1", label: "Suspended only" },
        ]}
      />
    </AdminFilterSheetFields>
  );
}
