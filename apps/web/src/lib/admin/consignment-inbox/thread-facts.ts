import { formatEstimateRangeShort, formatWholeMoney } from "@/lib/money/currency";
import { CONSIGNMENT_STATUS, consignmentStatus } from "@/lib/seller/consignment-status";
import { formatStaffDate, formatStaffDateTime } from "@auction/staff-ui";
import type { ItemSubmissionStatus, LotStatus } from "@auction/types";
import type { StatusBadgeShape, StatusBadgeTone } from "@auction/ui/lax";
import type { ConsignmentThreadDetail } from "@auction/validators";

/**
 * The facts beside a thread, so a specialist answers "is the date fixed?" without opening
 * another tab: the consignment (stage, sale and date, lot, estimate, reserve, agreement,
 * reference) and the client (account, who is in the thread, who else hears of a reply). Each
 * fact appears once; a fact the consignment does not have yet is left out, never shown empty.
 */

export type ThreadFact = {
  id: string;
  label: string;
  value: string;
  /** A muted second line: "19 Nov 2026, 18:00", "Waiting for an owner or admin". */
  detail?: string;
  /** The consignment's step, shown as its badge instead of text. */
  stage?: { label: string; tone: StatusBadgeTone; shape: StatusBadgeShape };
  /** Adds a copy control. */
  copy?: string;
  href?: string;
};

/**
 * The stage as the consignment's step, in the words the seller's own stepper uses ("Agreement to
 * accept"), from the shared status mapping rather than the submission's workflow status.
 */
export function consignmentStage(detail: Pick<ConsignmentThreadDetail, "facts">) {
  const { facts } = detail;
  const status = consignmentStatus({
    submission: facts.stage as ItemSubmissionStatus,
    agreement: !facts.agreement
      ? "none"
      : facts.agreement.state === "accepted"
        ? "accepted"
        : "open",
    lot: facts.lot ? { status: facts.lot.status as LotStatus, sold: facts.lot.sold } : null,
    unsoldChoice: null,
  });
  return CONSIGNMENT_STATUS[status];
}

export function consignmentFacts(detail: ConsignmentThreadDetail): ThreadFact[] {
  const { facts } = detail;
  const stage = consignmentStage(detail);
  const rows: ThreadFact[] = [
    {
      id: "stage",
      label: "Stage",
      value: stage.label,
      stage: { label: stage.label, tone: stage.tone, shape: stage.shape },
    },
  ];
  if (facts.sale) {
    rows.push({
      id: "sale",
      label: "Sale",
      value: facts.sale.name,
      ...(facts.sale.startsAt
        ? { detail: formatStaffDateTime(facts.sale.startsAt, { zoneLabel: true }) }
        : {}),
      href: `/admin/sales/${facts.sale.id}`,
    });
  }
  if (facts.lot) {
    rows.push({
      id: "lot",
      label: "Lot",
      value: facts.lot.number != null ? `Lot ${facts.lot.number}` : "Draft lot",
      href: `/admin/lots/${facts.lot.id}`,
    });
  }
  if (facts.estimate?.low && facts.estimate.high) {
    rows.push({
      id: "estimate",
      label: "Estimate",
      value: formatEstimateRangeShort({
        low: facts.estimate.low,
        high: facts.estimate.high,
        currency: facts.estimate.currency,
      }),
    });
  }
  if (facts.reserve) {
    rows.push({
      id: "reserve",
      label: "Reserve",
      value: formatWholeMoney(facts.reserve.amount, facts.reserve.currency),
    });
  }
  if (facts.agreement) {
    rows.push(
      facts.agreement.state === "accepted" && facts.agreement.acceptedAt
        ? {
            id: "agreement",
            label: "Agreement",
            value: `Accepted ${formatStaffDate(facts.agreement.acceptedAt)}`,
          }
        : {
            id: "agreement",
            label: "Agreement",
            value: `Sent ${formatStaffDate(facts.agreement.proposedAt)}`,
            detail: "Waiting for an owner or admin to accept",
          },
    );
  }
  rows.push({
    id: "reference",
    label: "Reference",
    value: detail.submission.reference,
    copy: detail.submission.reference,
  });
  return rows;
}

export function clientFacts(detail: ConsignmentThreadDetail): ThreadFact[] {
  const rows: ThreadFact[] = [];
  const { account, people } = detail;
  if (account) {
    const kind = account.kind === "organisation" ? "Organisation" : "Private seller";
    const count = people.accountConsignmentCount;
    rows.push({
      id: "account",
      label: "Account",
      value: account.name,
      detail:
        count > 0 ? `${kind} · ${count} ${count === 1 ? "consignment" : "consignments"}` : kind,
      href: `/admin/legal-entities/${account.id}`,
    });
  }
  if (people.sender) {
    rows.push({
      id: "sender",
      label: "In this thread",
      value: people.sender.name,
      detail: people.sender.role,
    });
  }
  if (people.alsoNotified.length > 0) {
    rows.push({
      id: "notified",
      label: "Also notified",
      value: people.alsoNotified.join(", "),
      detail: "Owners and admins",
    });
  }
  return rows;
}
