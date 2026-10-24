"use client";

import type { DisputesStaffRow } from "@/lib/admin/finance/disputes-staff-list.vm";
import {
  CellLink,
  DetailPanel,
  KeyValueList,
  MetaItem,
  type OverflowAction,
  OverflowMenu,
  PanelSection,
  StaffButton,
  StaffDate,
  StatusBadge,
  Timeline,
} from "@auction/staff-ui";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

/** The row `…` menu's links, shared with the panel's own `…`. */
export function disputeLinkActions(row: DisputesStaffRow): OverflowAction[] {
  return [
    ...(row.lotId ? [{ id: "lot", label: "Open lot", href: `/admin/lots/${row.lotId}` }] : []),
    ...(row.buyerId
      ? [
          {
            id: "buyer",
            label: "Open buyer",
            href: `/admin/clients/${encodeURIComponent(row.buyerId)}`,
          },
        ]
      : []),
    {
      id: "seller",
      label: "Open seller",
      href: `/admin/legal-entities/${encodeURIComponent(row.sellerId)}`,
    },
  ];
}

export function disputePaymentHref(row: DisputesStaffRow): string {
  return `/admin/payments?q=${encodeURIComponent(row.paymentId)}`;
}

/**
 * A dispute case beside the list: lot and status, a meta line (amount, reason, opened), "Open
 * payment" and the links to the people involved, then the case's facts and what Stripe reported.
 * Disputes are answered in Stripe and the money follows the payment, so the next step is the payment.
 */
export function DisputeQuickView({
  row,
  onClose,
}: {
  row: DisputesStaffRow | null;
  onClose: () => void;
}) {
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row?.title ?? "Dispute case"}
      {...(row ? { description: row.reason } : {})}
      status={
        row ? (
          <StatusBadge
            tone={row.statusPresentation.tone}
            live={row.statusPresentation.live ?? false}
          >
            {row.statusPresentation.label}
          </StatusBadge>
        ) : null
      }
      meta={
        row ? (
          <>
            <MetaItem label="Amount">{row.amount}</MetaItem>
            <MetaItem label="Opened">
              <StaffDate value={row.openedAt} />
            </MetaItem>
            {row.closedAt ? (
              <MetaItem label="Closed">
                <StaffDate value={row.closedAt} />
              </MetaItem>
            ) : null}
          </>
        ) : null
      }
      overflow={
        row ? (
          <OverflowMenu
            size="icon-sm"
            label={`More actions for dispute ${row.title}`}
            Link={Link}
            actions={disputeLinkActions(row)}
          />
        ) : null
      }
      footer={
        row ? (
          <StaffButton asChild variant="primary" icon={<ArrowUpRight aria-hidden />}>
            <Link href={disputePaymentHref(row)}>Open payment</Link>
          </StaffButton>
        ) : null
      }
      activity={
        row ? (
          <Timeline
            label={`Activity on dispute ${row.title}`}
            events={row.timeline}
            empty="Stripe has not reported anything on this case yet."
          />
        ) : null
      }
    >
      {row ? (
        <PanelSection title="Summary">
          <KeyValueList
            items={[
              { label: "Amount", value: row.amount, numeric: true },
              { label: "Reason", value: row.reason },
              {
                label: "Lot",
                value: row.lotId ? (
                  <CellLink href={`/admin/lots/${row.lotId}`} Link={Link}>
                    {row.title}
                  </CellLink>
                ) : null,
              },
              {
                label: "Buyer",
                value:
                  row.buyerId && row.buyer ? (
                    <CellLink
                      href={`/admin/clients/${encodeURIComponent(row.buyerId)}`}
                      Link={Link}
                    >
                      {row.buyer}
                    </CellLink>
                  ) : null,
              },
              {
                label: "Seller",
                value: (
                  <CellLink
                    href={`/admin/legal-entities/${encodeURIComponent(row.sellerId)}`}
                    Link={Link}
                  >
                    {row.seller}
                  </CellLink>
                ),
              },
              { label: "Opened", value: <StaffDate value={row.openedAt} withTime /> },
              {
                label: "Closed",
                value: row.closedAt ? <StaffDate value={row.closedAt} withTime /> : null,
              },
              { label: "Stripe dispute ID", value: row.id, copyValue: row.id },
              { label: "Payment ID", value: row.paymentId, copyValue: row.paymentId },
            ]}
          />
        </PanelSection>
      ) : null}
    </DetailPanel>
  );
}
