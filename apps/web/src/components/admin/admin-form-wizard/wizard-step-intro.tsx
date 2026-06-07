type StepIntroCopy = {
  title: string;
  body: string;
  nextHint?: string;
};

type Props = {
  copy: StepIntroCopy;
};

/**
 * Per-step guidance: purpose, context, and what comes next.
 * The "Step N of M" counter lives solely in the shared progress indicator
 * (WizardProgress) to avoid duplicating it in the form body.
 */
export function WizardStepIntro({ copy }: Props) {
  return (
    <div className="space-y-2 border-b border-border-hairline/60 pb-6">
      <h2 className="font-headline text-xl text-on-surface">{copy.title}</h2>
      <p className="font-body text-sm text-on-surface-variant">{copy.body}</p>
      {copy.nextHint ? (
        <p className="font-body text-xs text-on-surface-variant">
          <span className="font-medium text-on-surface">Next:</span> {copy.nextHint}
        </p>
      ) : null}
    </div>
  );
}
