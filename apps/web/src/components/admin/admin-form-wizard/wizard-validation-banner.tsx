"use client";

import { Notice, StaffButton } from "@auction/staff-ui";

type Props = {
  message: string;
  stepLabel?: string;
  onJumpToStep?: () => void;
};

/** What stopped the wizard, with a way to the step that needs fixing. */
export function WizardValidationBanner({ message, stepLabel, onJumpToStep }: Props) {
  return (
    <Notice
      tone="danger"
      alert
      title={stepLabel ? `Check ${stepLabel.toLowerCase()}` : "Check the highlighted fields"}
      actions={
        onJumpToStep ? (
          <StaffButton type="button" size="sm" variant="secondary" onClick={onJumpToStep}>
            Go to step
          </StaffButton>
        ) : null
      }
    >
      {message}
    </Notice>
  );
}
