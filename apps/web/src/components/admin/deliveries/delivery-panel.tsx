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
  Notice,
  PanelSection,
  StaffButton,
  StaffMoney,
  StatusBadge,
  Timeline,
  ViewOnlyBadge,
  formatStaffDateTime,
} from "@auction/staff-ui";
import Link from "next/link";
import { useState } from "react";

const COPY = DELIVERIES_COPY.panel;

/**
 * One delivery beside the list (D4): the lot and its status in the header, the buyer, sale and
 * when they asked, then what staff need to price it (where to, the size, the hammer price, paid
 * or not), the quote, the delivery once booked, and its history. Read-only staff see the same
 * facts with "View only" (PRM-3). Dispatch, tracking and delivered are recorded on Lot
 * fulfilment, linked from the header for those who can open it, not repeated here.
 *
 * It sits beside the list from 1024px (D3: the price and waiting columns stay in view). D6: a lot
 * in the address with no delivery says so with a way back, and a delivery that moves on while its
 * panel is open (the buyer withdrew or accepted, seen on the next refresh) says it changed.
 */
export function DeliveryPanel({
  row,
  missing,
  onBack,
  canWork,
  panelProps,
  now,
}: {
  row: DeliveryView | null;
  /** The address names a lot with no delivery (withdrawn and gone, or a wrong link). */
  missing: boolean;
  /** Closes the panel, back to the list as it was. */
  onBack: () => void;
  canWork: boolean;
  panelProps: Pick<DetailPanelProps, "open" | "onOpenChange" | "queue">;
  now: Date;
}) {
  const changed = useChangedWhileOpen(row);
  if (!row) {
    return (
      <DetailPanel
        {...panelProps}
        open={panelProps.open && missing}
        beside
        title={COPY.notFound.title}
      >
        <Notice
          tone="warning"
          title={COPY.notFound.notice}
          actions={
            <StaffButton variant="secondary" size="sm" onClick={onBack}>
              {COPY.notFound.back}
            </StaffButton>
          }
        />
      </DetailPanel>
    );
  }
  const price = deliveryPrice(row);
  const booked = row.quote.status === "accepted" || row.fulfilment !== null;
  return (
    <DetailPanel
      {...panelProps}
      beside
      title={deliveryLotTitle(row.lot)}
      {...(changed
        ? {
            notice: (
              <Notice tone="info" title={COPY.changed.title}>
                {COPY.changed.body}
              </Notice>
            ),
          }
        : {})}
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
          value: (
            // One line, as the mockup has it: the buyer and their paddle never split.
            <span className="whitespace-nowrap">
              {DELIVERIES_COPY.join(
                [row.buyer.name, paddleLine(row.buyer)].filter((part): part is string =>
                  Boolean(part),
                ),
              )}
            </span>
          ),
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

/** What says where a delivery stands: the status, why it closed, and the quote's own status. */
function standing(row: DeliveryView): string {
  return [row.status, row.closedReason ?? "", row.quote.status].join("|");
}

/**
 * Whether the delivery shown has moved on since its panel opened on it (D6). Stepping to another
 * delivery, or closing the panel, starts again from what is shown then.
 */
function useChangedWhileOpen(row: DeliveryView | null): boolean {
  const [first, setFirst] = useState<{ lotId: string; standing: string } | null>(null);
  if (row === null) {
    if (first !== null) setFirst(null);
    return false;
  }
  if (first === null || first.lotId !== row.lotId) {
    setFirst({ lotId: row.lotId, standing: standing(row) });
    return false;
  }
  return first.standing !== standing(row);
}
