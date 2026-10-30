import { type ReactNode, forwardRef, useId } from "react";
import {
  MarketingGalleryDetailList,
  type MarketingGalleryTeamDetail,
} from "./marketing-gallery-team-band.js";
import { MarketingSuccessState } from "./marketing-success-state.js";

export type MarketingEnquiryStep = { title: string; body: string };

export type MarketingEnquiryConfirmationProps = {
  title: string;
  /** Who replies, how and when, e.g. "The gallery team will reply to ana@… within one working day." */
  lead: string;
  /** The enquiry's reference ("E-2041"), shown under the promise for the sender to quote. */
  reference?: string | null;
  /** What happens next, in order; two or three short steps. */
  steps: readonly MarketingEnquiryStep[];
  /** Heading over the direct lines, e.g. "Prefer to talk?". */
  contactTitle?: string;
  details?: readonly MarketingGalleryTeamDetail[];
  /** The way on: tracking the enquiry (signed in) or creating an account (guest), then close. */
  actions?: ReactNode;
  "data-testid"?: string;
};

/**
 * A designed confirmation once an enquiry is sent, shared by every LAX product that takes
 * enquiries: the tick and promise, what happens next, the gallery's direct lines and the way on.
 * The status region takes the ref, so the host can move focus to it when the form is replaced.
 */
export const MarketingEnquiryConfirmation = forwardRef<
  HTMLOutputElement,
  MarketingEnquiryConfirmationProps
>(function MarketingEnquiryConfirmation(
  {
    title,
    lead,
    reference,
    steps,
    contactTitle = "Prefer to talk?",
    details = [],
    actions,
    "data-testid": testId = "marketing-enquiry-confirmation",
  },
  ref,
) {
  const stepsId = useId();
  const contactId = useId();
  return (
    <div className="flex flex-col gap-8" data-testid={testId}>
      <MarketingSuccessState
        ref={ref}
        tabIndex={-1}
        title={title}
        description={lead}
        actions={
          reference ? (
            <p className="m-0 font-body text-sm leading-5 text-on-surface-variant">
              Your reference{" "}
              <span className="font-medium text-on-surface tabular-nums">{reference}</span>
            </p>
          ) : undefined
        }
        className="pt-4! pb-0! outline-none"
      />
      {steps.length > 0 ? (
        <section aria-labelledby={stepsId} className="flex flex-col gap-4">
          <h3
            id={stepsId}
            className="m-0 font-headline text-lg font-medium leading-7 text-on-surface"
          >
            What happens next
          </h3>
          <ol className="m-0 flex list-none flex-col gap-4 p-0">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-full border border-outline-variant font-label text-sm font-medium leading-none text-on-surface"
                >
                  {index + 1}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="m-0 font-body text-base font-medium leading-6 text-on-surface">
                    {step.title}
                  </p>
                  <p className="m-0 font-body text-sm leading-6 text-on-surface-variant">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {details.length > 0 ? (
        <section
          aria-labelledby={contactId}
          className="flex flex-col gap-3 border-t border-border-hairline pt-6"
        >
          <h3
            id={contactId}
            className="m-0 font-body text-base font-medium leading-6 text-on-surface"
          >
            {contactTitle}
          </h3>
          <MarketingGalleryDetailList details={details} />
        </section>
      ) : null}
      {actions ? <div className="flex flex-col gap-3">{actions}</div> : null}
    </div>
  );
});
