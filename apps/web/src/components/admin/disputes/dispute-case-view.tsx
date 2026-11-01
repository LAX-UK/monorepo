"use client";

import { DisputeAllocationCard } from "@/components/admin/disputes/dispute-allocation-card";
import { DisputeCaseRail } from "@/components/admin/disputes/dispute-case-rail";
import { DisputeEvidenceCard } from "@/components/admin/disputes/dispute-evidence-card";
import {
  disputeAllocationMode,
  disputeCaseHeader,
  disputeDeadlineBlock,
  disputeTimelineEvents,
} from "@/lib/admin/finance/dispute-case.vm";
import { disputeStripeHref } from "@/lib/admin/finance/dispute-links";
import { DISPUTES_LIST_PATH } from "@/lib/admin/finance/disputes-staff-list.vm";
import { notify } from "@/lib/ui/notify";
import { disputeDeadline } from "@auction/domain";
import {
  DetailPage,
  MetaItem,
  OverflowMenu,
  Section,
  StaffBreadcrumbs,
  StaffDate,
  type StaffLinkComponent,
  StatusBadge,
  Timeline,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { Copy, ExternalLink } from "@auction/staff-ui/icons";
import type { DisputeDeskCase } from "@auction/types";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

function copy(value: string, noun: string) {
  void navigator.clipboard
    ?.writeText(value)
    .then(() => notify.success(`${noun} copied`))
    .catch(() => notify.error(`Could not copy the ${noun.toLowerCase()}`));
}

/**
 * One dispute case on the staff record template: the amount and reason with its status and
 * allocation state, the facts that matter at a glance, then the allocation (editable by finance
 * while the case waits for it), where the evidence stands, and the case's history. Deadline,
 * buyer, card payment and Stripe record sit in the side column.
 */
export function DisputeCaseView({
  found,
  nowIso,
  canAllocate,
  canOpenClient,
}: {
  found: DisputeDeskCase;
  /** The moment the page was read, so the deadline renders the same on server and client. */
  nowIso: string;
  canAllocate: boolean;
  canOpenClient: boolean;
}) {
  const now = new Date(nowIso);
  const header = disputeCaseHeader(found);
  const mode = disputeAllocationMode(found);
  const deadline = disputeDeadlineBlock(found, now, (value) =>
    formatStaffDateTime(value, { zoneLabel: true }),
  );
  const deadlinePassed =
    disputeDeadline(
      {
        dueBy: found.dueBy ? new Date(found.dueBy) : null,
        status: found.status,
        evidenceSubmitted: found.evidenceSubmitted,
      },
      now,
    ).state === "overdue";

  return (
    <DetailPage
      breadcrumbs={
        <StaffBreadcrumbs
          Link={NextLink}
          items={[{ label: "Disputes", href: DISPUTES_LIST_PATH }, { label: header.title }]}
        />
      }
      title={header.title}
      status={
        <>
          <StatusBadge tone={header.status.tone}>{header.status.label}</StatusBadge>
          {found.awaitingAllocation || found.allocationState === "allocated" ? (
            <StatusBadge tone={header.allocation.tone}>{header.allocation.label}</StatusBadge>
          ) : null}
        </>
      }
      meta={
        <>
          <MetaItem label="Buyer">{found.buyerLabel ?? "Unknown"}</MetaItem>
          <MetaItem label="Opened">
            <StaffDate value={found.openedAt} className="text-staff-fg" />
          </MetaItem>
          {found.dueBy && deadline.detail ? (
            <MetaItem label="Respond by">
              <StaffDate value={found.dueBy} withTime className="text-staff-fg" />
            </MetaItem>
          ) : null}
          <MetaItem label="Case ID">{found.stripeDisputeId}</MetaItem>
        </>
      }
      overflow={
        <OverflowMenu
          label="More case actions"
          Link={NextLink}
          actions={[
            {
              id: "stripe",
              label: "Open in Stripe",
              icon: ExternalLink,
              href: disputeStripeHref(found.stripeDisputeId),
            },
            {
              id: "copy-id",
              label: "Copy case ID",
              icon: Copy,
              onSelect: () => copy(found.stripeDisputeId, "Case ID"),
            },
          ]}
        />
      }
      access={canAllocate ? "full" : "read-only"}
      resource="Disputes"
      rail={<DisputeCaseRail found={found} deadline={deadline} canOpenClient={canOpenClient} />}
      railLabel="Case details"
    >
      <DisputeAllocationCard
        found={found}
        mode={mode}
        canAllocate={canAllocate}
        deadlinePassed={deadlinePassed}
      />
      <DisputeEvidenceCard found={found} />
      <Section title="History">
        <Timeline
          label="Dispute history"
          events={disputeTimelineEvents(found.timeline, found.currency, found.status)}
        />
      </Section>
    </DetailPage>
  );
}
