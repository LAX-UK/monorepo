"use client";

import { Notice, StaffButton } from "@auction/staff-ui";
import type { WriteFailure } from "./use-data-request-writes";

/**
 * A change that did not go through, shown where it was made. A stale edit offers a reload and
 * keeps what was typed; any other failure says nothing was changed and offers another try.
 */
export function DataRequestWriteFailure({
  failure,
  title,
  onReload,
  className,
}: {
  failure: WriteFailure;
  /** What failed, in the past tense: "The request couldn't be closed". */
  title: string;
  onReload: () => void;
  className?: string;
}) {
  return failure.stale ? (
    <Notice
      tone="warning"
      alert
      title="This request changed"
      {...(className ? { className } : {})}
      actions={
        <StaffButton size="sm" variant="secondary" onClick={onReload}>
          Reload
        </StaffButton>
      }
    >
      Someone else changed this request while you had it open. Reload to see their changes; what you
      typed stays in the box.
    </Notice>
  ) : (
    <Notice tone="danger" alert title={title} {...(className ? { className } : {})}>
      {failure.message}
    </Notice>
  );
}
