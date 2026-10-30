"use client";

import {
  buildOrderTimeline,
  fulfilmentOptionLabel,
  orderLineLabel,
  presentFulfilmentStatus,
  presentOrderStatus,
} from "@/server/domain/order-detail.vm";
import { orderNumber } from "@/server/domain/order-list.vm";
import type { AdminOrderDetail } from "@auction/shop-contracts";
import {
  DetailPanel,
  ErrorState,
  KeyValueList,
  MappedStatusBadge,
  PanelSection,
  Skeleton,
  StaffButton,
  Timeline,
  formatGbp,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { ArrowUpRight } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type LoadState =
  | { status: "loading" }
  | { status: "ok"; detail: AdminOrderDetail }
  | { status: "failed" };

/** Reads the order through the staff BFF, the same route and permissions as the order page. */
async function fetchOrder(orderId: string): Promise<AdminOrderDetail> {
  const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Order read failed (${response.status})`);
  return (await response.json()) as AdminOrderDetail;
}

function QuickViewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
          <div key={index} className="grid grid-cols-[160px_1fr] gap-4 py-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

/**
 * The order beside the list: status, buyer, money, lines and the latest activity, with the full
 * page one click away for refunds and fulfilment changes. Opens on Enter or a row click.
 */
export function OrderQuickView({
  orderId,
  onClose,
}: {
  orderId: string | null;
  onClose: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback((id: string) => {
    setState({ status: "loading" });
    fetchOrder(id)
      .then((detail) => setState({ status: "ok", detail }))
      .catch(() => setState({ status: "failed" }));
  }, []);

  useEffect(() => {
    if (orderId) load(orderId);
  }, [orderId, load]);

  const detail = state.status === "ok" ? state.detail : null;

  return (
    <DetailPanel
      open={orderId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={detail ? `Order ${orderNumber(detail.orderId, detail.reference)}` : "Order"}
      description={
        detail
          ? `${detail.buyerName ?? detail.buyerEmail ?? "Unknown buyer"} · ${formatGbp(detail.totalPence)}`
          : "Loading…"
      }
      status={
        detail ? <MappedStatusBadge status={detail.status} present={presentOrderStatus} /> : null
      }
      footer={
        orderId ? (
          <StaffButton asChild variant="primary" icon={<ArrowUpRight aria-hidden />}>
            <Link href={`/orders/${orderId}`}>Open order</Link>
          </StaffButton>
        ) : null
      }
    >
      {state.status === "loading" ? <QuickViewSkeleton /> : null}
      {state.status === "failed" ? (
        <ErrorState
          headingLevel="h3"
          title="This order did not load"
          description="Check your connection and try again."
          action={
            <StaffButton size="sm" onClick={() => orderId && load(orderId)}>
              Try again
            </StaffButton>
          }
        />
      ) : null}
      {detail ? (
        <>
          <PanelSection title="Summary">
            <KeyValueList
              items={[
                {
                  label: "Order",
                  value: orderNumber(detail.orderId, detail.reference),
                },
                { label: "Order ID", value: detail.orderId, copyValue: detail.orderId },
                {
                  label: detail.buyerIsGuest ? "Guest buyer" : "Buyer",
                  value: detail.buyerName ?? detail.buyerEmail ?? "Unknown buyer",
                },
                ...(detail.buyerName && detail.buyerEmail
                  ? [{ label: "Email", value: detail.buyerEmail }]
                  : []),
                { label: "Total", value: formatGbp(detail.totalPence), numeric: true },
                { label: "Placed", value: formatStaffDateTime(detail.createdAt) },
                {
                  label: "Paid",
                  value: detail.paidAt ? formatStaffDateTime(detail.paidAt) : "Not paid",
                },
                {
                  label: "Fulfilment",
                  value: detail.fulfilmentRecord ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <MappedStatusBadge
                        status={detail.fulfilmentRecord.status}
                        present={presentFulfilmentStatus}
                      />
                      <span className="text-staff-muted">
                        {fulfilmentOptionLabel(detail.fulfilmentRecord.option)}
                      </span>
                    </span>
                  ) : (
                    fulfilmentOptionLabel(detail.fulfilment)
                  ),
                },
              ]}
            />
          </PanelSection>
          <PanelSection title={`Items (${detail.lines.length})`}>
            <ul className="divide-y divide-staff-line-subtle rounded-staff-lg border border-staff-line">
              {detail.lines.map((line) => (
                <li
                  key={line.orderLineId}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-staff-sm"
                >
                  <span className="min-w-0 truncate">{orderLineLabel(line)}</span>
                  <span className="shrink-0 tabular-nums">{formatGbp(line.unitPricePence)}</span>
                </li>
              ))}
            </ul>
          </PanelSection>
          <PanelSection title="Activity">
            <Timeline label="Order activity" events={buildOrderTimeline(detail).slice(0, 5)} />
          </PanelSection>
        </>
      ) : null}
    </DetailPanel>
  );
}
