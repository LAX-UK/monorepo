"use client";

import { Notice, StaffButton } from "@auction/staff-ui";

/** A change that did not go through, as the dialog or section shows it. */
export type PurchaseProblemWriteFailure = { message: string; stale: boolean };

/**
 * A change that did not go through, shown where it was made. A stale edit offers a reload and
 * keeps what was typed; any other failure says nothing was changed.
 */
export function PurchaseProblemWriteFailureNotice({
  failure,
  title,
  onReload,
}: {
  failure: PurchaseProblemWriteFailure;
  /** What failed, in the past tense: "The report couldn't be resolved". */
  title: string;
  onReload: () => void;
}) {
  return failure.stale ? (
    <Notice
      tone="warning"
      alert
      title="This report changed"
      actions={
        <StaffButton size="sm" variant="secondary" onClick={onReload}>
          Reload
        </StaffButton>
      }
    >
      Someone else changed this report while you had it open. Reload to see their changes; what you
      typed stays in the box.
    </Notice>
  ) : (
    <Notice tone="danger" alert title={title}>
      {failure.message}
    </Notice>
  );
}
