"use client";

import { Notice, StaffButton } from "@auction/staff-ui";

/**
 * Shown when a save was refused because someone else saved the same product first. Nothing was
 * written; the editor chooses whether to take their version or save over it.
 */
export function MerchandiseConflictBanner({
  savedAt,
  busy,
  onReload,
  onKeepMine,
}: {
  /** Time of the other save, already formatted. */
  savedAt: string;
  busy: boolean;
  onReload: () => void;
  onKeepMine: () => void;
}) {
  return (
    <Notice
      tone="warning"
      alert
      title={`Someone else saved this product at ${savedAt}`}
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
