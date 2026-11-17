"use client";

import { DELIVERIES_COPY } from "@/lib/admin/deliveries/deliveries-copy";
import {
  deliveryBadges,
  deliveryBuyerLine,
  deliveryLotTitle,
  deliveryPaidLine,
  deliveryPrice,
  deliveryStateKey,
  deliveryTimeline,
  lotFulfilmentHref,
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
import { useRef } from "react";

const COPY = DELIVERIES_COPY.panel;

type PanelProps = Pick<DetailPanelProps, "open" | "onOpenChange" | "queue">;

/**
 * One delivery beside the list (D4): the lot and its status in the header, the buyer, sale and
 * when they asked, then what staff need to price it (where to, the size, the hammer price, paid
 * or not), the quote, the delivery once booked, and its history. Read-only staff see the same
 * facts with "View only" (PRM-3). Dispatch, tracking and delivered are recorded on Lot
 * fulfilment, linked from the header for those who can open it, not repeated here.
 *
 * From 1280px it sits beside the list (the mockup's 480px side panel), so the Status, Price and
 * Waiting columns stay in view and the next row is one click away.
 *
 * D6 states: a lot in the URL that has no delivery (withdrawn, or a stale link) says so with a
 * way back to the list; a request that moves on while its panel is open (the list refreshed and
 * its status or quote changed) says the buyer changed it.
 */
export function DeliveryPanel({
  row,
  canWork,
  panelProps,
  now,
  missing = false,
}: {
  row: DeliveryView | null;
  canWork: boolean;
  panelProps: PanelProps;
  now: Date;
  /** A lot is open in the URL and no delivery was found for it. */
  missing?: boolean;
}) {
  const changed = useChangedWhileOpen(row);
  if (!row) {
    return (
      <DetailPanel
        {...panelProps}
        open={missing}
        beside
        title={COPY.fallbackTitle}
        notice={
          <Notice
            tone="warning"
            title={COPY.notFound.title}
            actions={
              <StaffButton
                variant="secondary"
                size="sm"
                onClick={() => panelProps.onOpenChange(false)}
              >
                {COPY.notFound.back}
              </StaffButton>
            }
          >
            {COPY.notFound.description}
          </Notice>
        }
      >
        {null}
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
        { label: COPY.meta.buyer, value: deliveryBuyerLine(row.buyer) },
        ...(row.sale ? [{ label: COPY.meta.sale, value: row.sale.title }] : []),
        { label: COPY.meta.asked, value: formatStaffDateTime(row.quote.requestedAt, now) },
      ]}
      {...(changed
        ? {
            notice: (
              <Notice tone="warning" title={COPY.changed.title}>
                {COPY.changed.description}
              </Notice>
            ),
          }
        : {})}
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

/**
 * Whether the open delivery moved on since its panel first showed it: same lot, a different
 * status or quote status (the buyer withdrew or accepted, or the courier took it). Opening
 * another lot starts again from what that one shows.
 */
function useChangedWhileOpen(row: DeliveryView | null): boolean {
  const first = useRef<{ lotId: string; key: string } | null>(null);
  if (!row) {
    first.current = null;
    return false;
  }
  if (first.current?.lotId !== row.lotId) {
    first.current = { lotId: row.lotId, key: deliveryStateKey(row) };
  }
  return first.current.key !== deliveryStateKey(row);
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
