import { StepHeader } from "@auction/staff-ui";

type StepIntroCopy = {
  title: string;
  body: string;
  nextHint?: string;
};

/** A step's title, purpose and what comes next, on the kit step header. */
export function WizardStepIntro({ copy }: { copy: StepIntroCopy }) {
  return (
    <StepHeader
      title={copy.title}
      description={copy.body}
      {...(copy.nextHint ? { next: copy.nextHint } : {})}
    />
  );
}
