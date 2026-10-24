"use client";

import { UnsavedChangesGuard } from "@auction/staff-ui";
import { useRouter } from "next/navigation";

type Props = {
  isDirty: boolean;
  /** What is being edited, for "Discard changes to <label>?". */
  label?: string;
};

/**
 * Asks before a form's unsaved changes are lost: closing the tab, in-app links, ⌘K and Cancel
 * buttons that navigate through `useGuardedNavigation`. The Back button is left alone here: the
 * wizards move between steps with `router.replace` and navigate on save, which the kit's Back
 * guard would need released first.
 */
export function FormDirtyGuard({ isDirty, label }: Props) {
  const router = useRouter();
  return (
    <UnsavedChangesGuard
      dirty={isDirty}
      navigate={router.push}
      interceptBack={false}
      {...(label ? { label } : {})}
    />
  );
}
