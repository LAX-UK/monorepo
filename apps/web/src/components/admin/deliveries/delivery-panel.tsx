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
import { type ReactNode, useState } from "react";

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
 * D6 states: a lot in the URL that has no delivery (nobody asked, or a stale link) says so with
 * a way back to the list; a read that failed says so with Try again (never "not found"); a
 * request that moves on while its panel is open (the list refreshed and its status or quote
 * changed) says the buyer changed it.
 */
export function DeliveryPanel({
  row,
  canWork,
  panelProps,
  now,
  missing = false,
  loadFailed = false,
  onRetry,
  footerActions,
  ownChange = null,
}: {
  row: DeliveryView | null;
  canWork: boolean;
  panelProps: PanelProps;
  now: Date;
  /** A lot is open in the URL and no delivery was found for it. */
  missing?: boolean;
  /** With `missing`: the read failed (not a 404), so the delivery may well exist. */
  loadFailed?: boolean;
  /** Reads the page again, for the load error's Try again. */
  onRetry?: () => void;
  /**
   * The footer's actions for this delivery (D5), e.g. "Can't deliver"; the caller decides who
   * sees which. Nothing for read-only staff, so the panel has no footer.
   */
  footerActions?: ReactNode;
  /**
   * A state the person just moved this delivery to themselves (`lotId` and its
   * `deliveryStateKey`), so their own change is not announced as the buyer's.
   */
  ownChange?: { lotId: string; key: string } | null;
}) {
  const changed = useChangedWhileOpen(row, ownChange);
  if (!row && loadFailed) {
    // D6 error: never "not found" for a read that failed; say so and offer Try again.
    return (
      <DetailPanel
        {...panelProps}
        open={missing}
        beside
        title={COPY.fallbackTitle}
        notice={
          <Notice
            tone="danger"
            alert
            title={COPY.loadError.title}
            actions={
              <span className="flex flex-wrap gap-2">
                {onRetry ? (
                  <StaffButton variant="secondary" size="sm" onClick={onRetry}>
                    {COPY.loadError.retry}
                  </StaffButton>
                ) : null}
                <StaffButton
                  variant="ghost"
                  size="sm"
                  onClick={() => panelProps.onOpenChange(false)}
                >
                  {COPY.loadError.back}
                </StaffButton>
              </span>
            }
          >
            {COPY.loadError.description}
          </Notice>
        }
      >
        {null}
      </DetailPanel>
    );
  }
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
      {...(footerActions ? { footer: footerActions } : {})}
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
        {row.quote.declineReason ? (
          <KeyValueList
            items={[{ label: COPY.quote.declineReason, value: row.quote.declineReason }]}
          />
        ) : null}
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
function useChangedWhileOpen(
  row: DeliveryView | null,
  ownChange: { lotId: string; key: string } | null,
): boolean {
  const current = row ? { lotId: row.lotId, key: deliveryStateKey(row) } : null;
  // What the panel first showed for the open lot, kept in state (never a ref written while
  // rendering) and reset when another lot opens, React's "adjust state when a prop changes".
  const [seen, setSeen] = useState(current);
  const mine =
    current !== null && current.lotId === ownChange?.lotId && current.key === ownChange.key;
  if (current?.lotId !== seen?.lotId || (mine && seen?.key !== current.key)) {
    setSeen(current);
    return false;
  }
  return current !== null && seen !== null && seen.key !== current.key;
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
