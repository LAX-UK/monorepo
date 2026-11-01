import { disputeStripeHref } from "@/lib/admin/finance/dispute-links";
import { disputeStatusView } from "@auction/domain";
import { KeyValueList, Section, StaffButtonLink, StaffDate, StatusBadge } from "@auction/staff-ui";
import { ArrowUpRight } from "@auction/staff-ui/icons";
import type { DisputeDeskCase } from "@auction/types";

const OUTCOMES: Record<string, string> = {
  won: "The card network decided in our favour. The funds are returned and any seller share taken back is reversed.",
  lost: "The card network decided against us. The disputed amount stays with the cardholder.",
  warning_closed: "The early warning closed without a dispute.",
  prevented: "The dispute was prevented before it reached the card network.",
  charge_refunded: "The charge was refunded, which closes the dispute.",
};

/**
 * Where the evidence stands. Evidence is prepared and submitted in Stripe, so this section shows
 * the state Stripe reports and the way to it; once the case is closed it says how it ended.
 */
export function DisputeEvidenceCard({ found }: { found: DisputeDeskCase }) {
  const closed = disputeStatusView(found.status) === "closed";
  const submitted = found.evidenceSubmitted;
  return (
    <Section
      title={closed ? "Outcome" : "Evidence"}
      id="evidence"
      action={
        closed ? null : (
          <StatusBadge tone={submitted ? "success" : "warning"}>
            {submitted ? "Submitted" : "Not submitted"}
          </StatusBadge>
        )
      }
      bodyClassName="flex flex-col gap-3"
    >
      {closed ? (
        <>
          <p className="text-staff-sm text-staff-fg">
            {OUTCOMES[found.status] ?? "The dispute is closed."}
          </p>
          {found.closedAt ? (
            <KeyValueList
              items={[{ label: "Closed", value: <StaffDate value={found.closedAt} withTime /> }]}
            />
          ) : null}
        </>
      ) : (
        <>
          <p className="text-staff-sm text-staff-fg">
            {submitted
              ? "Evidence has been submitted to the card network. They usually decide within several weeks, and the result appears here."
              : "Prepare the evidence and submit it in Stripe before the respond-by date. Once it is submitted the card network decides, usually within several weeks."}
          </p>
          <div>
            <StaffButtonLink
              variant="secondary"
              href={disputeStripeHref(found.stripeDisputeId)}
              target="_blank"
              rel="noreferrer"
            >
              Open in Stripe
              <ArrowUpRight aria-hidden className="size-4" />
            </StaffButtonLink>
          </div>
        </>
      )}
    </Section>
  );
}
