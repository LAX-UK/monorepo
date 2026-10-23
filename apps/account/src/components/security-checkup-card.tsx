import type { CheckupStepVm, SecurityCheckupVm } from "@/server/domain/account-security-checkup.vm";
import { Button } from "@auction/ui/components/button";
import { ProgressRing } from "@auction/ui/components/progress-ring";
import { CARD, CARD_TITLE } from "./account-ui";

function StepIcon({ done }: { done: boolean }) {
  // Done is green and open is the neutral outline: teal marks the product, never success.
  return done ? (
    <svg
      viewBox="0 0 24 24"
      className="size-6 shrink-0 text-success"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m7.5 12.5 3 3 6-6.5" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      className="size-6 shrink-0 text-outline-variant"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

function CheckupStep({ step }: { step: CheckupStepVm }) {
  return (
    <li className="flex flex-wrap items-start gap-3 border-t border-border-hairline px-4 py-4 first:border-t-0 sm:px-5">
      <StepIcon done={step.done} />
      <div className="min-w-0 flex-1 basis-[calc(100%-2.25rem)] sm:basis-0">
        <p className="text-sm font-medium text-on-surface">
          {step.title}
          {step.done ? <span className="sr-only"> (done)</span> : null}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-on-surface-variant">{step.description}</p>
      </div>
      {step.actionLabel ? (
        <Button asChild variant="outline" size="sm" className="ml-9 min-h-11 shrink-0 sm:ml-0">
          <a href={step.href} aria-label={`${step.actionLabel}: ${step.title}`}>
            {step.actionLabel}
          </a>
        </Button>
      ) : null}
    </li>
  );
}

/**
 * Security Checkup: a ring with "N of M recommended steps done" and the steps behind it. The ring
 * takes the product accent; a finished checkup is a quiet confirmation in the success colour.
 */
export function SecurityCheckupCard({ checkup }: { checkup: SecurityCheckupVm }) {
  return (
    <section aria-labelledby="security-checkup-heading" className={`overflow-hidden ${CARD}`}>
      <div className="flex items-center gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <ProgressRing
          value={checkup.doneCount}
          max={checkup.total}
          label="Security Checkup progress"
          size={72}
          className="text-product-accent"
        >
          <span className="font-headline text-sm font-semibold text-on-surface">
            {checkup.doneCount}/{checkup.total}
          </span>
        </ProgressRing>
        <div className="min-w-0">
          <h2 id="security-checkup-heading" className={CARD_TITLE}>
            Security Checkup
          </h2>
          <p className="text-sm text-on-surface-variant">{checkup.summary}</p>
        </div>
      </div>
      {checkup.complete ? (
        <output className="block border-t border-border-hairline bg-success-container px-4 py-3 text-sm text-on-success-container sm:px-6">
          Your account is up to date. Nothing needs your attention right now.
        </output>
      ) : null}
      <ul className="border-t border-border-hairline">
        {checkup.steps.map((step) => (
          <CheckupStep key={step.id} step={step} />
        ))}
      </ul>
    </section>
  );
}
