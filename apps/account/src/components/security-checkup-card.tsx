import { Button } from "@/components/account-button";
import type { SecurityCheckupVm } from "@/server/domain/account-security-checkup.vm";
import { MarketingViewAllChevron } from "@auction/marketing-ui";
import { ProgressRing } from "@auction/ui/components/progress-ring";
import { CARD } from "./account-ui";

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 text-success"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

/**
 * The Security Checkup as one compact row: a 40px ring, "N of M done" and what is left, with a
 * way into Security. On a phone the whole row opens it; a finished checkup stays as a quiet
 * confirmation with a check in the success colour, never the accent.
 */
export function SecurityCheckupCard({ checkup }: { checkup: SecurityCheckupVm }) {
  return (
    <section
      aria-labelledby="security-checkup-heading"
      className={`relative flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-container-low active:bg-surface-container sm:px-5 ${CARD}`}
    >
      <ProgressRing
        value={checkup.doneCount}
        max={checkup.total}
        label="Security checkup progress"
        size={40}
        strokeWidth={4}
        className={checkup.complete ? "text-success" : "text-product-accent"}
      >
        {checkup.complete ? (
          <CheckIcon />
        ) : (
          <span className="font-headline text-xs font-semibold text-on-surface">
            {checkup.doneCount}/{checkup.total}
          </span>
        )}
      </ProgressRing>
      <div className="min-w-0 flex-1">
        <h2 id="security-checkup-heading" className="text-sm font-semibold text-on-surface">
          <a
            href={checkup.reviewHref}
            className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
          >
            {checkup.headline}
          </a>
        </h2>
        {checkup.nextSteps ? (
          <p className="mt-0.5 text-xs text-on-surface-variant">{checkup.nextSteps}</p>
        ) : null}
      </div>
      {checkup.complete ? null : (
        <Button asChild variant="outline" className="relative z-10 hidden shrink-0 sm:inline-flex">
          <a href={checkup.reviewHref}>Review</a>
        </Button>
      )}
      <MarketingViewAllChevron
        className={`size-4 shrink-0 text-on-surface-variant ${checkup.complete ? "" : "sm:hidden"}`}
      />
    </section>
  );
}
