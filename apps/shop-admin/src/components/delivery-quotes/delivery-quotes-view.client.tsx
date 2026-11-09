"use client";

import { DELIVERY_QUOTE_VIEWS, quotePrice, quoteStatusLabel } from "@/lib/delivery-quotes";
import {
  declineDeliveryQuote,
  sendDeliveryQuote,
} from "@/server/application/delivery-quote-actions.server";
import type {
  AdminDeliveryQuote,
  AdminDeliveryQuoteList,
  AdminDeliveryQuoteView,
} from "@auction/shop-contracts";
import {
  type DataColumn,
  ListPage,
  Notice,
  StaffButton,
  StaffDate,
  TabNav,
  type TabNavItem,
} from "@auction/staff-ui";
import Link from "next/link";
import { useState } from "react";
import { DeclineQuoteDialog } from "./decline-quote-dialog.client";
import { SendQuoteDialog } from "./send-quote-dialog.client";

const EMPTY_COPY: Record<AdminDeliveryQuoteView, string> = {
  waiting: "No requests are waiting for a price.",
  quoted: "No quotes are out with buyers.",
  closed: "No closed requests yet.",
};

/**
 * Delivery quotes: the requests buyers sent for delivery outside the UK. Everyone who can open
 * orders reads them; sending a price or turning a request down needs `order.write`, so without it
 * there are no action buttons. The tabs are real links, so each view has its own address.
 */
export function DeliveryQuotesView({
  view,
  data,
  canWrite,
  actions = { send: sendDeliveryQuote, decline: declineDeliveryQuote },
}: {
  view: AdminDeliveryQuoteView;
  data: AdminDeliveryQuoteList;
  canWrite: boolean;
  actions?: {
    send: typeof sendDeliveryQuote;
    decline: typeof declineDeliveryQuote;
  };
}) {
  const [quoting, setQuoting] = useState<AdminDeliveryQuote | null>(null);
  const [declining, setDeclining] = useState<AdminDeliveryQuote | null>(null);

  const tabs: TabNavItem[] = DELIVERY_QUOTE_VIEWS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    href:
      tab.id === "waiting" ? "/orders/delivery-quotes" : `/orders/delivery-quotes?view=${tab.id}`,
    ...(tab.id === "waiting" && data.waitingCount > 0
      ? { count: data.waitingCount, countTone: "attention" as const, countLabel: "waiting" }
      : {}),
  }));

  const columns: DataColumn<AdminDeliveryQuote>[] = [
    {
      id: "order",
      header: "Order",
      mobile: "title",
      truncate: false,
      cell: (row) => (
        <span className="flex flex-col">
          <Link
            href={`/orders/${row.orderId}`}
            className="font-medium text-staff-fg underline-offset-2 hover:underline"
          >
            {row.orderReference}
          </Link>
          <span className="whitespace-normal break-words text-staff-xs text-staff-muted">
            {row.items.join(", ")} ·{" "}
            <span className="tabular-nums">{quotePrice(row.merchandisePence)}</span>
          </span>
        </span>
      ),
    },
    {
      id: "destination",
      header: "Delivering to",
      mobile: "meta",
      truncate: false,
      cell: (row) => (
        <span className="flex flex-col">
          <span>
            {row.recipientName ? `${row.recipientName}, ${row.countryName}` : row.countryName}
          </span>
          <span className="whitespace-normal break-words text-staff-xs text-staff-muted">
            {row.address.slice(0, -1).join(", ")}
          </span>
        </span>
      ),
    },
    {
      id: "state",
      header: "State",
      mobile: "meta",
      truncate: false,
      cell: (row) => (
        <span className="flex flex-col">
          <span>{quoteStatusLabel(row)}</span>
          {row.quote ? (
            <span className="text-staff-xs tabular-nums text-staff-muted">
              {quotePrice(row.quote.pricePence)} with {row.quote.carrier}
            </span>
          ) : null}
          {row.declineNote ? (
            <span className="whitespace-normal break-words text-staff-xs text-staff-muted">
              {row.declineNote}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "held",
      header: view === "closed" ? "Requested" : "Held until",
      mobile: "meta",
      truncate: false,
      cell: (row) => (
        <StaffDate value={view === "closed" ? row.requestedAt : row.holdUntil} withTime />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      headerHidden: true,
      mobile: "actions",
      cell: (row) =>
        canWrite && (row.status === "requested" || row.status === "quoted") ? (
          <span className="flex flex-col items-stretch gap-1 md:flex-row md:items-center">
            <StaffButton
              variant="secondary"
              size="sm"
              className="max-md:min-h-11"
              aria-label={`${row.status === "quoted" ? "Revise quote for" : "Quote"} ${row.orderReference}`}
              onClick={() => setQuoting(row)}
            >
              {row.status === "quoted" ? "Revise" : "Send quote"}
            </StaffButton>
            <StaffButton
              variant="ghost"
              size="sm"
              className="max-md:min-h-11"
              aria-label={`Turn down ${row.orderReference}`}
              onClick={() => setDeclining(row)}
            >
              <span className="whitespace-nowrap">Can't deliver</span>
            </StaffButton>
          </span>
        ) : null,
    },
  ];

  return (
    <>
      <ListPage<AdminDeliveryQuote>
        title="Delivery quotes"
        description="Buyers asking for delivery outside the UK. Send a price and carrier, or say we can't deliver there. The print is held while you decide."
        Link={Link}
        listKey="lax-admin.delivery-quotes"
        access={canWrite ? "full" : "read-only"}
        views={
          <TabNav
            items={tabs}
            activeId={view}
            label="Delivery quote views"
            Link={Link}
            overflow="scroll"
          />
        }
        notice={
          data.paymentOpen ? undefined : (
            <Notice
              tone="warning"
              title="Buyers can't pay for delivery outside the UK yet. You can still send quotes: buyers see the price and are told payment is not open, and nothing is charged until it is."
            />
          )
        }
        filtered={false}
        empty={{
          illustration: "parcel",
          title: EMPTY_COPY[view],
        }}
        noResults={{ noun: "requests" }}
        table={{
          label: "Delivery quote requests",
          columns,
          data: data.items,
          getRowId: (row) => row.id,
          defaultDensity: "comfortable",
        }}
      />
      {quoting ? (
        <SendQuoteDialog
          key={quoting.id}
          request={quoting}
          open
          onOpenChange={(open) => {
            if (!open) setQuoting(null);
          }}
          send={actions.send}
          paymentOpen={data.paymentOpen}
        />
      ) : null}
      {declining ? (
        <DeclineQuoteDialog
          key={declining.id}
          request={declining}
          open
          onOpenChange={(open) => {
            if (!open) setDeclining(null);
          }}
          decline={actions.decline}
        />
      ) : null}
    </>
  );
}
