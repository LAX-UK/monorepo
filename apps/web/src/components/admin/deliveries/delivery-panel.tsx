"use client";

import { DELIVERIES_COPY } from "@/lib/admin/deliveries/deliveries-copy";
import {
  deliveryBadges,
  deliveryLotTitle,
  deliveryPaidLine,
  deliveryPrice,
  deliveryTimeline,
  lotFulfilmentHref,
  paddleLine,
} from "@/lib/admin/deliveries/deliveries.vm";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { DeliveryView } from "@/lib/data/http/admin-deliveries.schema";
import {
  DetailPanel,
  type DetailPanelProps,
  KeyValueList,
  PanelSection,
  StaffMoney,
  StatusBadge,
  Timeline,
  ViewOnlyBadge,
  formatStaffDateTime,
} from "@auction/staff-ui";
import Link from "next/link";

const COPY = DELIVERIES_COPY.panel;

/**
 * One delivery beside the list (D4): the lot and its status in the header, the buyer, sale and
 * when they asked, then what staff need to price it (where to, the size, the hammer price, paid
 * or not), the quote, the delivery once booked, and its history. Read-only staff see the same
 * facts with "View only" (PRM-3). Dispatch, tracking and delivered are recorded on Lot
 * fulfilment, linked from the header for those who can open it, not repeated here.
 */
export function DeliveryPanel({
  row,
  canWork,
  panelProps,
  now,
}: {
  row: DeliveryView | null;
  canWork: boolean;
  panelProps: Pick<DetailPanelProps, "open" | "onOpenChange" | "queue">;
  now: Date;
}) {
  if (!row) {
    return (
      <DetailPanel {...panelProps} title={COPY.fallbackTitle}>
        {null}
      </DetailPanel>
    );
  }
  const price = deliveryPrice(row);
  const booked = row.quote.status === "accepted" || row.fulfilment !== null;
  return (
    <DetailPanel
      {...panelProps}
      title={deliveryLotTitle(row.lot)}
      status={
        <span className="flex flex-wrap items-center gap-1.5">
          {deliveryBadges(row).map((badge) => (
            <StatusBadge
              key={badge.label}
              tone={badge.tone}
              {...(badge.shape ? { shape: badge.shape } : {})}
            >
              {badge.label}
            </StatusBadge>
          ))}
          {canWork ? null : <ViewOnlyBadge />}
        </span>
      }
      meta={[
        {
          label: COPY.meta.buyer,
          value: [row.buyer.name, paddleLine(row.buyer)].filter(Boolean).join(" · "),
        },
        ...(row.sale ? [{ label: COPY.meta.sale, value: row.sale.title }] : []),
        { label: COPY.meta.asked, value: formatStaffDateTime(row.quote.requestedAt, now) },
      ]}
      {...(canWork ? { fullPage: { href: lotFulfilmentHref(row.lotId), Link } } : {})}
      summary={[
        { label: COPY.summary.destination, value: row.destination, copyValue: row.destination },
        { label: COPY.summary.size, value: row.lot.dimensions },
        {
          label: COPY.summary.hammer,
          value: <StaffMoney minor={row.lot.hammerMinor} />,
          numeric: true,
        },
        { label: COPY.summary.paid, value: deliveryPaidLine(row, now) },
      ]}
      activity={
        <Timeline
          label={COPY.activityLabel}
          empty={COPY.noActivity}
          events={deliveryTimeline(row)}
        />
      }
    >
      <PanelSection title={COPY.quote.title}>
        {price ? (
          <KeyValueList
            items={[
              { label: COPY.quote.price, value: price, numeric: true },
              { label: COPY.quote.note, value: row.quote.note },
              {
                label: COPY.quote.quoted,
                value: row.quote.quotedAt ? formatStaffDateTime(row.quote.quotedAt, now) : null,
              },
            ]}
          />
        ) : (
          <p className="text-staff-sm text-staff-muted">{COPY.quote.none}</p>
        )}
      </PanelSection>
      {booked ? (
        <PanelSection title={COPY.delivery.title}>
          <KeyValueList
            items={[
              {
                label: COPY.delivery.method,
                value:
                  row.fulfilment?.method === "collection"
                    ? COPY.delivery.collection
                    : COPY.delivery.shipping,
              },
              { label: COPY.delivery.carrier, value: row.fulfilment?.carrier ?? null },
              {
                label: COPY.delivery.tracking,
                value: row.fulfilment?.trackingNumber ?? null,
                ...(row.fulfilment?.trackingNumber
                  ? { copyValue: row.fulfilment.trackingNumber }
                  : {}),
              },
              {
                label: COPY.delivery.fulfilment,
                value: row.fulfilment ? (
                  <FulfilmentBadge status={row.fulfilment.status} />
                ) : (
                  COPY.delivery.notStarted
                ),
              },
            ]}
          />
        </PanelSection>
      ) : null}
    </DetailPanel>
  );
}

function FulfilmentBadge({ status }: { status: string }) {
  const presentation = staffStatus("fulfilment", status);
  return (
    <StatusBadge
      tone={presentation.tone}
      {...(presentation.shape ? { shape: presentation.shape } : {})}
    >
      {presentation.label}
    </StatusBadge>
  );
}
