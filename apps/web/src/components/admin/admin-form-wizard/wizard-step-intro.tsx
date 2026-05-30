type StepIntroCopy = {
  title: string;
  body: string;
  nextHint?: string;
};

type Props = {
  stepIndex: number;
  stepCount: number;
  copy: StepIntroCopy;
};

/** Per-step guidance: purpose, context, and what comes next. */
export function WizardStepIntro({ stepIndex, stepCount, copy }: Props) {
  return (
    <div className="space-y-2 border-b border-border-hairline/60 pb-6">
      <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Step {stepIndex + 1} of {stepCount}
      </p>
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
