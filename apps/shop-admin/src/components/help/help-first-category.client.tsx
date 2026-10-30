"use client";

import { HelpCategoryDialog } from "@/components/help/help-category-dialog.client";
import { EmptyState, StaffButton } from "@auction/staff-ui";
import { Plus } from "@auction/staff-ui/icons";
import { useState } from "react";

/**
 * Shown on the new-question page while no category exists: every question belongs to one, so the
 * category is made here, in a dialog, and the page carries on with the question once it is saved.
 */
export function HelpFirstCategory() {
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div className="rounded-staff-lg border border-staff-line bg-staff-surface">
        <EmptyState
          illustration="frame"
          title="Create a category first"
          description="Every question belongs to a category, so add one before writing questions."
          action={
            <StaffButton
              variant="primary"
              icon={<Plus aria-hidden />}
              onClick={() => setCreating(true)}
            >
              New category
            </StaffButton>
          }
        />
      </div>
      {creating ? <HelpCategoryDialog category={null} onClose={() => setCreating(false)} /> : null}
    </>
  );
}
