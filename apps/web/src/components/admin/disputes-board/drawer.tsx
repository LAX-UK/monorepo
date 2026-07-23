"use client";

import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTableMoneyCell } from "@/components/admin/admin-table-money-cell";
import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
import { CatalogDomainEventsTimeline } from "@/components/admin/catalog/catalog-domain-events-timeline";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import type { AdminDisputeTableRow } from "@/lib/data/view-models/admin-disputes-table.vm";
import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

function toTimelineEvents(row: AdminDisputeTableRow): AdminDomainEventRow[] {
  return (row.timelineEvents ?? []).map((e) => ({
    id: e.id,
    aggregateType: "payment",
    aggregateId: row.paymentId,
    eventType: e.eventType,
    payload: e.payload,
    actorUserId: null,
    actingLegalEntityId: null,
    occurredAt: new Date(e.occurredAt),
  }));
}

export function DisputeDrawerContent({
  row,
  onClose,
}: {
  row: AdminDisputeTableRow;
  onClose: () => void;
}) {
  const timeline = toTimelineEvents(row);
  const buyerLinkLabel = row.buyerLabel?.trim() || "View buyer profile";

  return (
    <div className="space-y-6 pt-2">
      <AdminPreviewSheetHeader
        title="Dispute case"
        fullPageHref="/admin/disputes"
        subtitle={
          <p className="truncate font-body text-sm text-on-surface-variant">
            {row.lotTitle ?? row.reasonLabel}
          </p>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <AdminStatusBadge domain="dispute" status={row.status} />
        <AdminTableMoneyCell display={row.amountDisplay} emphasis="default" />
      </div>

      <dl className="grid grid-cols-1 gap-3 text-sm">
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Opened</dt>
          <dd>{formatDateTime(row.openedAt)}</dd>
        </div>
        {row.closedAt ? (
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">Closed</dt>
            <dd>{formatDateTime(row.closedAt)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Reason</dt>
          <dd>{row.reasonLabel}</dd>
        </div>
        {row.lotId && row.lotTitle ? (
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">Lot</dt>
            <dd>
              <Link
                href={`/admin/lots/${row.lotId}`}
                className="text-link hover:underline"
                onClick={onClose}
              >
                {row.lotTitle}
              </Link>
            </dd>
          </div>
        ) : null}
        {row.buyerId ? (
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">Buyer</dt>
            <dd>
              <Link
                href={`/admin/clients/${row.buyerId}`}
                className="text-link hover:underline"
                onClick={onClose}
              >
                {buyerLinkLabel}
              </Link>
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Seller</dt>
          <dd>
            <Link
              href={`/admin/legal-entities/${row.sellerLegalEntityId}`}
              className="text-link hover:underline"
              onClick={onClose}
            >
              {row.sellerDisplayName ?? "View legal entity"}
            </Link>
          </dd>
        </div>
      </dl>

      <AdminTechnicalIdDisclosure
        items={[
          { label: "Stripe dispute ID", value: row.stripeDisputeId },
          { label: "Payment ID", value: row.paymentId },
          { label: "Buyer ID", value: row.buyerId },
          { label: "Seller legal entity ID", value: row.sellerLegalEntityId },
          { label: "Lot ID", value: row.lotId },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/payments?q=${encodeURIComponent(row.paymentId)}`} onClick={onClose}>
            Open payment
          </Link>
        </Button>
      </div>

      <section className="space-y-2">
        <h3 className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Audit timeline
        </h3>
        <CatalogDomainEventsTimeline events={timeline} showTechnicalDetails={false} />
      </section>
    </div>
  );
}
