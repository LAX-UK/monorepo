"use client";

import { sendDeliveryQuoteAction } from "@/lib/actions/admin/admin-deliveries";
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
import { type QuoteAction, quoteActionFor } from "@/lib/admin/deliveries/delivery-quote-form";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { DeliveryView } from "@/lib/data/http/admin-deliveries.schema";
import { notify } from "@/lib/ui/notify";
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
import { PencilLine, Send } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useState } from "react";
import { DeliveryQuoteDialog, type QuoteDialogOutcome } from "./delivery-quote-dialog";

const COPY = DELIVERIES_COPY.panel;

/** D6: the "Quote sent" toast stays 5 seconds. */
const SENT_TOAST_MS = 5000;

type PanelProps = Pick<DetailPanelProps, "open" | "onOpenChange" | "queue">;

export type DeliveryPanelProps = {
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
  /** Whether the Send or Change quote dialog is open (the row menu opens it too). */
  quoteOpen?: boolean;
  onQuoteOpenChange?: (open: boolean) => void;
  /** The server action that sends the quote; injectable for tests. */
  sendQuote?: typeof sendDeliveryQuoteAction;
};

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
 *
 * Fulfilment and Administrators price it from the footer (D5, PRD-2): Send quote while the buyer
 * waits, Change quote once one is sent. Read-only staff get no footer (PRM-3).
 */
export function DeliveryPanel(props: DeliveryPanelProps) {
  const {
    row,
    canWork,
    panelProps,
    now,
    missing = false,
    loadFailed = false,
    onRetry,
    sendQuote = sendDeliveryQuoteAction,
  } = props;
  const { changed, expect } = useChangedWhileOpen(row);
  const [ownQuoteOpen, setOwnQuoteOpen] = useState(false);
  const quoteOpen = props.quoteOpen ?? ownQuoteOpen;
  const setQuoteOpen = props.onQuoteOpenChange ?? setOwnQuoteOpen;
  // The action the dialog opened with, for the lot it opened on. A refusal reads the delivery
  // again, and a withdrawn request no longer offers one; the dialog stays to say why until closed.
  const [dialog, setDialog] = useState<{ lotId: string; action: QuoteAction } | null>(null);
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
  const quoteAction = canWork ? quoteActionFor(row) : null;
  const opened = dialog?.lotId === row.lotId ? dialog.action : null;
  if (quoteOpen && quoteAction && !opened) {
    setDialog({ lotId: row.lotId, action: quoteAction });
  }
  const dialogAction = quoteOpen ? (opened ?? quoteAction) : quoteAction;
  const lotTitle = deliveryLotTitle(row.lot);
  const onQuoteOutcome = (outcome: QuoteDialogOutcome) => {
    // The panel's own write, or another person's price, is not the buyer changing the request:
    // the panel takes the quoted state as its new starting point, so the notice stays for the
    // buyer's own moves (D6). A request the buyer withdrew or accepted still shows it.
    if (outcome.kind === "sent" || outcome.by === "staff") expect(row.lotId, "quoted:quoted");
    if (outcome.kind === "sent") {
      notify.success(DELIVERIES_COPY.quote.sent(lotTitle), { duration: SENT_TOAST_MS });
    }
  };
  return (
    <DetailPanel
      {...panelProps}
      beside
      {...(quoteAction
        ? {
            footer: <DeliveryPanelFooter action={quoteAction} onQuote={() => setQuoteOpen(true)} />,
          }
        : {})}
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
      {canWork && dialogAction ? (
        <DeliveryQuoteDialog
          row={row}
          action={dialogAction}
          open={quoteOpen}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
            setQuoteOpen(open);
          }}
          send={sendQuote}
          onOutcome={onQuoteOutcome}
        />
      ) : null}
    </DetailPanel>
  );
}

/**
 * Whether the open delivery moved on since its panel first showed it: same lot, a different
 * status or quote status (the buyer withdrew or accepted, or the courier took it). Opening
 * another lot starts again from what that one shows. `expect` takes a state the panel itself
 * caused (a quote it sent) as the new starting point, so its own change is not the buyer's.
 */
function useChangedWhileOpen(row: DeliveryView | null): {
  changed: boolean;
  expect: (lotId: string, key: string) => void;
} {
  const current = row ? { lotId: row.lotId, key: deliveryStateKey(row) } : null;
  // What the panel first showed for the open lot, kept in state (never a ref written while
  // rendering) and reset when another lot opens, React's "adjust state when a prop changes".
  const [seen, setSeen] = useState(current);
  const expect = (lotId: string, key: string) => setSeen({ lotId, key });
  if (current?.lotId !== seen?.lotId) {
    setSeen(current);
    return { changed: false, expect };
  }
  return { changed: current !== null && seen !== null && seen.key !== current.key, expect };
}

/**
 * The panel's footer (PRD-2: the state's primary action last). Part 3 of D9 (#1528, "Can't
 * deliver", D8) adds its secondary action here, before the primary, for the same two states.
 */
function DeliveryPanelFooter({
  action,
  onQuote,
}: {
  action: "send" | "change";
  onQuote: () => void;
}) {
  return (
    <>
      {/* Seam for D8 "Can't deliver" (part 3): its button goes here, before the primary. */}
      <StaffButton
        variant="primary"
        className="max-sm:flex-1"
        icon={action === "send" ? <Send aria-hidden /> : <PencilLine aria-hidden />}
        onClick={onQuote}
      >
        {action === "send" ? DELIVERIES_COPY.quote.send : DELIVERIES_COPY.quote.change}
      </StaffButton>
    </>
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
