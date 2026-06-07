/** Continue button label, optionally naming the next step. */
export function wizardContinueLabel(nextStepLabel?: string): string {
  return nextStepLabel ? `Continue to ${nextStepLabel}` : "Continue";
}
