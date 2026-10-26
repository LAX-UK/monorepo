"use client";

import { Notice, StaffButton } from "@auction/staff-ui";

/**
 * Shown when a save was refused because someone else saved the same item first. Nothing was
 * written; the editor chooses whether to take their version or save over it.
 */
export function EditorialConflictBanner({
  singular,
  savedAt,
  busy,
  onReload,
  onKeepMine,
}: {
  /** "exhibition", for the sentence "Someone else saved this exhibition". */
  singular: string;
  /** Time of the other save, already formatted; omitted when only an opaque version is known. */
  savedAt?: string;
  busy: boolean;
  onReload: () => void;
  onKeepMine: () => void;
}) {
  return (
    <Notice
      tone="warning"
      alert
      title={
        savedAt
          ? `Someone else saved this ${singular} at ${savedAt}`
          : `Someone else changed this ${singular}`
      }
      actions={
        <>
          <StaffButton size="sm" variant="secondary" disabled={busy} onClick={onReload}>
            Reload
          </StaffButton>
          <StaffButton size="sm" variant="secondary" disabled={busy} onClick={onKeepMine}>
            Keep my changes
          </StaffButton>
        </>
      }
    >
      Your changes have not been saved. Reload to see their version, which discards your changes, or
      keep your changes and save over theirs.
    </Notice>
  );
}
