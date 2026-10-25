"use client";

import { Notice, StaffButton, formatStaffDateTime } from "@auction/staff-ui";
import type { WizardDraftPayload } from "./wizard-draft";

type Props = {
  draft: WizardDraftPayload;
  onResume: () => void;
  onDiscard: () => void;
};

/** A saved draft of this form, offered back on load. */
export function WizardResumeBanner({ draft, onResume, onDiscard }: Props) {
  return (
    <Notice
      tone="warning"
      title="You have an unfinished draft"
      actions={
        <>
          <StaffButton type="button" size="sm" variant="ghost" onClick={onDiscard}>
            Discard draft
          </StaffButton>
          <StaffButton type="button" size="sm" variant="secondary" onClick={onResume}>
            Resume draft
          </StaffButton>
        </>
      }
    >
      Saved {formatStaffDateTime(draft.savedAt, { zoneLabel: true })}, at step {draft.stepIndex + 1}
      .
    </Notice>
  );
}
