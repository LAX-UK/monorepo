"use client";

import type { AdminActivityRow } from "@/lib/admin/admin-home-types";
import type { SaleReadinessSlice } from "@/lib/admin/dashboard/sale-readiness.slice";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminSaleReadinessRow } from "@/lib/data/http/admin-sale-readiness.schema";
import { getSocket } from "@/lib/socket";
import {
  type DataColumn,
  MappedStatusBadge,
  Notice,
  PrimaryCell,
  RelatedRecordsSection,
  Section,
  StaffButton,
  type StaffLinkComponent,
  StatusBadge,
  rowActionsColumn,
} from "@auction/staff-ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const NextLink: StaffLinkComponent = Link;
const COUNT = new Intl.NumberFormat("en-GB");

/** The lots that changed most recently, each linking to its lot. */
export function RecentActivitySection({
  rows,
  unavailable,
}: {
  rows: readonly AdminActivityRow[];
  /** Why the activity could not load. */
  unavailable?: string | null;
}) {
  const columns = useMemo<DataColumn<AdminActivityRow>[]>(
    () => [
      {
        id: "lot",
        header: "Lot",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell href={row.href} Link={NextLink} secondary={row.meta || undefined}>
            {row.title}
          </PrimaryCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "128px",
        mobile: "badge",
        truncate: false,
        cell: (row) =>
          row.statusLabel ? (
            <MappedStatusBadge
              status={row.statusLabel}
              present={(status) =>
                staffStatus("lot", status, { lot: { winnerId: row.winnerId ?? null } })
              }
            />
          ) : null,
      },
      {
        id: "price",
        header: "Price",
        width: "136px",
        numeric: true,
        mobile: "meta",
        cell: (row) => row.priceLabel ?? null,
      },
    ],
    [],
  );

  if (unavailable) {
    return (
      <Section title="Recent activity">
        <Notice tone="warning" title="Recent activity could not load">
          {unavailable}
        </Notice>
      </Section>
    );
  }

  return (
    <RelatedRecordsSection
      id="recent-activity"
      title="Recent activity"
      description="Lots changed most recently"
      label="Recent activity"
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      // The API sends the most recent first; the table keeps that order.
      defaultSort={{ columnId: "lot", direction: "desc" }}
      action={
        <StaffButton asChild size="sm" variant="ghost">
          <Link href="/admin/lots">All lots</Link>
        </StaffButton>
      }
      empty={{
        title: "No recent lot activity",
        description: "Lots appear here as they are created and changed.",
      }}
      density="comfortable"
    />
  );
}

/** "Opens in 3 days", "Open now". */
function saleTiming(row: AdminSaleReadinessRow): string | undefined {
  if (row.daysToStart == null) return undefined;
  if (row.daysToStart <= 0) return "Open now";
  return row.daysToStart === 1 ? "Opens tomorrow" : `Opens in ${row.daysToStart} days`;
}

function blockersText(row: AdminSaleReadinessRow): string {
  return row.blockers
    .map((blocker) =>
      blocker.count != null ? `${blocker.label} (${blocker.count})` : blocker.label,
    )
    .join(", ");
}

/**
 * Bids per minute right now, seeded from the server and counting bids as they arrive on the
 * live lots (at most twelve rooms are joined).
 */
function useLiveBids(initial: number, activeLotIds: readonly string[]) {
  const [extra, setExtra] = useState(0);
  useEffect(() => {
    const socket = getSocket();
    const rooms = activeLotIds.slice(0, 12);
    const onBid = () => setExtra((count) => count + 1);
    for (const lotId of rooms) socket.emit("joinLot", { lotId }, () => {});
    socket.on("bidUpdate", onBid);
    return () => {
      socket.off("bidUpdate", onBid);
      for (const lotId of rooms) socket.emit("leaveLot", { lotId }, () => {});
    };
  }, [activeLotIds]);
  return { perMinute: initial, sinceOpened: extra };
}

/**
 * Upcoming sales and the saleroom pulse: bids per minute and live sessions, then each sale about
 * to open with what still blocks it and a link to its console.
 */
export function SalesSection({
  saleReadiness,
  activeLotIds,
  showPulse,
  showSales,
}: {
  saleReadiness: SaleReadinessSlice;
  activeLotIds: readonly string[];
  showPulse: boolean;
  showSales: boolean;
}) {
  const data =
    saleReadiness.status === "ready" || saleReadiness.status === "empty"
      ? saleReadiness.data
      : { rows: [] as AdminSaleReadinessRow[], bidsPerMinute: 0, activeSaleroomSessions: 0 };
  const bids = useLiveBids(data.bidsPerMinute, activeLotIds);

  const columns = useMemo<DataColumn<AdminSaleReadinessRow>[]>(
    () => [
      {
        id: "sale",
        header: "Sale",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell href={row.href} Link={NextLink} secondary={saleTiming(row)}>
            {row.title}
          </PrimaryCell>
        ),
      },
      {
        id: "readiness",
        header: "Readiness",
        width: "120px",
        truncate: false,
        mobile: "badge",
        cell: (row) =>
          row.blockers.length === 0 ? (
            <StatusBadge tone="success">Ready</StatusBadge>
          ) : (
            <StatusBadge tone="warning">
              {row.blockers.length === 1 ? "1 blocker" : `${row.blockers.length} blockers`}
            </StatusBadge>
          ),
      },
      {
        id: "blockers",
        header: "What blocks it",
        mobile: "meta",
        cell: (row) => (row.blockers.length > 0 ? blockersText(row) : null),
      },
      rowActionsColumn<AdminSaleReadinessRow>({
        label: (row) => `Actions for ${row.title}`,
        Link: NextLink,
        actions: (row) => [
          { id: "sale", label: "Open sale", href: row.href },
          ...(row.consoleHref
            ? [{ id: "console", label: "Open saleroom console", href: row.consoleHref }]
            : []),
          ...row.blockers.map((blocker) => ({
            id: `blocker-${blocker.id}`,
            label: `Fix: ${blocker.label}`,
            href: blocker.href,
          })),
        ],
      }),
    ],
    [],
  );

  const sessions = data.activeSaleroomSessions;
  const pulse = showPulse
    ? [
        `${COUNT.format(bids.perMinute)} ${bids.perMinute === 1 ? "bid" : "bids"} a minute`,
        ...(bids.sinceOpened > 0
          ? [`${COUNT.format(bids.sinceOpened)} since you opened this page`]
          : []),
        `${COUNT.format(sessions)} live ${sessions === 1 ? "session" : "sessions"}`,
      ].join(" · ")
    : null;
  const saleroomLink = (
    <StaffButton asChild size="sm" variant="ghost">
      <Link href="/admin/saleroom">Saleroom</Link>
    </StaffButton>
  );

  if (!showSales) {
    return pulse ? (
      <Section title="Saleroom" description={pulse} action={saleroomLink}>
        <p>{sessions > 0 ? "A sale is live in the saleroom." : "No sale is live right now."}</p>
      </Section>
    ) : null;
  }

  if (saleReadiness.status === "unavailable") {
    return (
      <Section title="Upcoming sales" {...(pulse ? { description: pulse } : {})}>
        <Notice tone="warning" title="Upcoming sales could not load">
          {saleReadiness.message}
        </Notice>
      </Section>
    );
  }

  return (
    <RelatedRecordsSection
      id="upcoming-sales"
      title="Upcoming sales"
      description={pulse ?? "Sales about to open and what still blocks them"}
      label="Upcoming sales"
      columns={columns}
      data={data.rows}
      getRowId={(row) => row.saleId}
      // The API sends the soonest first; the table keeps that order.
      defaultSort={{ columnId: "sale", direction: "asc" }}
      action={saleroomLink}
      empty={{
        title: "No sales coming up",
        description:
          saleReadiness.status === "empty" && saleReadiness.message
            ? saleReadiness.message
            : "Scheduled sales appear here in the days before they open.",
      }}
      density="comfortable"
    />
  );
}
