import { wizardContinueLabel } from "@auction/ui/lib/wizard-copy";

/** Shared multi-step wizard copy — keep labels identical across every flow. */
export const WIZARD_COPY = {
  finishLater: "Finish later",
  leaveWithoutSaving: "Leave without saving",
  leaveWithoutSavingHint: "Recent edits may already be saved automatically.",
  back: "Back",
} as const;

export { wizardContinueLabel };
