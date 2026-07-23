"use client";

import {
  AdminFilterDraftInput,
  AdminFilterDraftSelect,
  AdminFilterToggleGroup,
  AdminFilterToggleRow,
} from "@/components/admin/filters/admin-filter-draft-fields";
import {
  AdminFilterSection,
  AdminFilterSheetFields,
  adminFilterFieldLabelClassName,
  adminFilterFieldStackClassName,
} from "@/components/admin/filters/admin-filter-section";
import { useAdminFilterDraftContext } from "@/components/admin/filters/admin-filter-sheet-root";
import { CategoryPicker } from "@/components/forms/category-picker";
import type { SubmissionsFilterDraft } from "@/lib/admin/filters/submissions-filter-adapter";
import type { CategoryNode } from "@auction/types";

type Props = {
  categories: CategoryNode[];
};

export function AdminSubmissionsFilterFields({ categories }: Props) {
  const { draft, patch } = useAdminFilterDraftContext<SubmissionsFilterDraft>();

  return (
    <AdminFilterSheetFields>
      <AdminFilterDraftInput
        id="admin-submissions-filter-q"
        label="Title contains"
        value={draft.q}
        onChange={(q) => patch({ q })}
        placeholder="Search submission titles…"
      />

      <div className={adminFilterFieldStackClassName}>
        <span className={adminFilterFieldLabelClassName}>Category</span>
        <CategoryPicker
          categories={categories}
          value={draft.categoryId ? [draft.categoryId] : []}
          onChange={(ids) => patch({ categoryId: ids[0] ?? "" })}
          multiple={false}
          placeholder="Any category"
          appearance="field"
          compact
        />
      </div>

      <AdminFilterSection label="Refine">
        <AdminFilterToggleGroup>
          <AdminFilterToggleRow
            id="admin-submissions-assigned-to-me"
            label="Assigned to me"
            checked={draft.assignedToMe}
            onCheckedChange={(assignedToMe) => patch({ assignedToMe })}
          />
          <AdminFilterToggleRow
            id="admin-submissions-quality-gaps"
            label="Quality gaps only"
            checked={draft.qualityGaps}
            onCheckedChange={(qualityGaps) => patch({ qualityGaps })}
          />
        </AdminFilterToggleGroup>
      </AdminFilterSection>

      <AdminFilterDraftSelect
        id="admin-submissions-sort"
        label="Sort"
        value={draft.sortBySla ? "sla" : ""}
        onChange={(sort) => patch({ sortBySla: sort === "sla" })}
        options={[
          { value: "", label: "Default order" },
          { value: "sla", label: "SLA priority (oldest first)" },
        ]}
      />
    </AdminFilterSheetFields>
  );
}
