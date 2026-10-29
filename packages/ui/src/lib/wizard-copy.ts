/**
 * A step name as it reads inside a sentence: "Details" becomes "details". Names that start with
 * an acronym or a proper noun in capitals ("LAX Account", "VAT") keep their capitals.
 */
function inSentence(label: string): string {
  const [first, second] = label;
  if (!first || (second && second !== second.toLowerCase())) return label;
  return first.toLowerCase() + label.slice(1);
}

/** Continue button label, optionally naming the next step in sentence case. */
export function wizardContinueLabel(nextStepLabel?: string): string {
  return nextStepLabel ? `Continue to ${inSentence(nextStepLabel)}` : "Continue";
}
