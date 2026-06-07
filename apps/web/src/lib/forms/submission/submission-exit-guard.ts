/** When the wizard should warn before the user leaves without submitting. */
export function submissionExitGuardActive(input: {
  isReviewStep: boolean;
  canSubmit: boolean;
  submittedThisSession: boolean;
}): boolean {
  return input.isReviewStep && input.canSubmit && !input.submittedThisSession;
}
