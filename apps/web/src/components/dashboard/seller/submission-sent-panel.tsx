import { CONSIGNMENT_STAGE_LABEL } from "@/lib/seller/consignment-status";
import { ButtonLink } from "@auction/ui/lax";
import { CircleCheck } from "lucide-react";
import Link from "next/link";

type Props = {
  /** The consignment reference ("C-1042"), when the submission has one. */
  reference: string | null;
  /** Where "View your consignment" goes. */
  consignmentHref: string;
  /** Where "Sell another work" goes. */
  sellAnotherHref: string;
  /** The one reply promise, from the sell-flow copy. */
  responsePromise: string;
};

/** What follows a send, in the stage names the Consignments list uses. */
const NEXT_STEPS = [
  {
    stage: CONSIGNMENT_STAGE_LABEL["in-review"],
    description: "A specialist looks at your work and replies with an estimate.",
  },
  {
    stage: CONSIGNMENT_STAGE_LABEL.accepted,
    description: "You agree the terms with us in writing, and we prepare it for sale.",
  },
  {
    stage: CONSIGNMENT_STAGE_LABEL["in-sale"],
    description: "Bidders see it. We pay you after the buyer has paid.",
  },
] as const;

/**
 * The page after a work is sent: that it went, who has it, when to expect an answer and what
 * the stages are from here. Names the reference so a call or email can quote it.
 */
export function SubmissionSentPanel({
  reference,
  consignmentHref,
  sellAnotherHref,
  responsePromise,
}: Props) {
  return (
    <div className="flex max-w-[640px] flex-col gap-8" data-testid="submission-sent">
      <header className="flex flex-col gap-2">
        <CircleCheck aria-hidden className="size-6 text-lax-success-fg" strokeWidth={1.75} />
        <h1 className="font-lax-display text-lax-24 font-semibold text-lax-fg">
          Sent to our specialists
          {reference ? (
            <span className="block text-lax-muted sm:inline">
              <span className="max-sm:sr-only"> · </span>Reference {reference}
            </span>
          ) : null}
        </h1>
        <p className="text-lax-16 text-lax-fg">{responsePromise}</p>
      </header>

      <section aria-labelledby="sent-what-next" className="flex flex-col gap-3">
        <h2 id="sent-what-next" className="font-lax-display text-lax-18 font-semibold text-lax-fg">
          What happens next
        </h2>
        <ol className="flex flex-col">
          {NEXT_STEPS.map((step, index) => (
            <li
              key={step.stage}
              className="flex gap-4 border-t border-lax-line py-4 first:border-t-0 first:pt-0"
            >
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-full border border-lax-line text-lax-13 font-medium text-lax-muted"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-lax-14 font-medium text-lax-fg">{step.stage}</p>
                <p className="text-lax-14 text-lax-muted">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink href={consignmentHref} Link={Link} variant="primary">
          View your consignment
        </ButtonLink>
        <ButtonLink href={sellAnotherHref} Link={Link} variant="secondary">
          Sell another work
        </ButtonLink>
      </div>
    </div>
  );
}
