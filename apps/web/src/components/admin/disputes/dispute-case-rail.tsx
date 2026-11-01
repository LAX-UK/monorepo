import type { DisputeDeadlineBlock } from "@/lib/admin/finance/dispute-case.vm";
import { disputeStripeHref } from "@/lib/admin/finance/dispute-links";
import {
  type KeyValueItem,
  KeyValueList,
  Section,
  StaffDate,
  StatusBadge,
  TextLink,
  formatStaffMoney,
} from "@auction/staff-ui";
import type { DisputeDeskCase } from "@auction/types";
import Link from "next/link";

const CARD_BRANDS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
};

function cardLabel(found: Pick<DisputeDeskCase, "cardBrand" | "cardLast4">): string | null {
  if (!found.cardLast4) return null;
  const brand = found.cardBrand ? (CARD_BRANDS[found.cardBrand] ?? found.cardBrand) : "Card";
  return `${brand} ending ${found.cardLast4}`;
}

/** The side column of a case: the deadline, the buyer, the card payment and the Stripe record. */
export function DisputeCaseRail({
  found,
  deadline,
  canOpenClient,
}: {
  found: DisputeDeskCase;
  deadline: DisputeDeadlineBlock;
  canOpenClient: boolean;
}) {
  const money = (pence: number) => formatStaffMoney(pence, found.currency);
  const card = cardLabel(found);
  const chargeTotal = found.invoices.reduce((sum, invoice) => sum + invoice.invoicePence, 0);

  const buyer =
    found.buyerId && found.buyerLabel ? (
      canOpenClient ? (
        <TextLink Link={Link} href={`/admin/clients/${encodeURIComponent(found.buyerId)}`}>
          {found.buyerLabel}
        </TextLink>
      ) : (
        found.buyerLabel
      )
    ) : (
      <span className="text-staff-muted">Unknown buyer</span>
    );

  const payment: KeyValueItem[] = [
    { label: "Disputed", value: money(found.amountPence), numeric: true },
    ...(chargeTotal > 0 && chargeTotal !== found.amountPence
      ? [{ label: "Charge total", value: money(chargeTotal), numeric: true }]
      : []),
    ...(card ? [{ label: "Card", value: card }] : []),
    {
      label: "Funds withdrawn",
      value: found.fundsWithdrawnAt ? <StaffDate value={found.fundsWithdrawnAt} withTime /> : "No",
    },
    ...(found.fundsReinstatedAt
      ? [{ label: "Funds returned", value: <StaffDate value={found.fundsReinstatedAt} withTime /> }]
      : []),
  ];

  const stripe: KeyValueItem[] = [
    { label: "Case ID", value: found.stripeDisputeId, copyValue: found.stripeDisputeId },
    { label: "Charge", value: found.chargeId, copyValue: found.chargeId },
    ...(found.networkReasonCode ? [{ label: "Network code", value: found.networkReasonCode }] : []),
  ];

  return (
    <>
      <Section title="Deadline" bodyClassName="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {deadline.tone ? (
            <StatusBadge tone={deadline.tone}>{deadline.headline}</StatusBadge>
          ) : (
            <p className="text-staff-md font-semibold text-staff-fg">{deadline.headline}</p>
          )}
        </div>
        {deadline.detail ? (
          <p className="text-staff-sm text-staff-muted">{deadline.detail}</p>
        ) : null}
      </Section>
      <Section title="Buyer">
        <p className="text-staff-sm text-staff-fg">{buyer}</p>
      </Section>
      <Section title="Card payment">
        <KeyValueList items={payment} />
      </Section>
      <Section
        title="Stripe"
        action={
          <TextLink external href={disputeStripeHref(found.stripeDisputeId)}>
            Open case
          </TextLink>
        }
      >
        <KeyValueList items={stripe} />
      </Section>
    </>
  );
}
