"use client";

import { OnsiteEventGuestList } from "@/components/admin/event-rsvps/onsite-event-guest-list";
import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import {
  DetailPage,
  type KeyValueItem,
  MetaItem,
  Notice,
  type OverflowAction,
  OverflowMenu,
  StaffButton,
  StatGrid,
  type StatItem,
  StatusBadge,
  formatStaffDateTime,
} from "@auction/staff-ui";
import type { OnsiteEventAdminDetail, OnsiteEventRsvpAdminRow } from "@auction/types";
import { Download, ExternalLink, Pencil, ScanLine } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type VenueDayCounts = {
  rsvped: number;
  galaCheckedIn: number;
  salePresent: number;
  paddled: number;
};

type Props = {
  event: OnsiteEventAdminDetail;
  rsvps: readonly OnsiteEventRsvpAdminRow[];
  /** Counts from the linked sale; null when no sale is linked or its counts did not load. */
  venueDayCounts?: VenueDayCounts | null;
  /** The linked sale's name. */
  linkedSaleTitle?: string | null;
  /** Why the guest list could not load, or a failure carried back from another page. */
  loadError?: string | null;
};

const LINK_CLASS =
  "staff-focus rounded-staff-xs underline underline-offset-2 decoration-staff-line-strong hover:decoration-2";

function filenameFrom(contentDisposition: string | null, fallback: string): string {
  const match = contentDisposition ? /filename="([^"]+)"/.exec(contentDisposition) : null;
  return match?.[1] ?? fallback;
}

/** Downloads the guest list as a CSV file; the failure, if any, is returned for the page to show. */
function useGuestListExport(slug: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await browserFetch(
        `${browserApiBase()}/admin/event-rsvps/${encodeURIComponent(slug)}/rsvps/export`,
        { headers: { Accept: "text/csv" } },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `The export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filenameFrom(res.headers.get("Content-Disposition"), `${slug}-rsvps.csv`);
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The guest list could not be downloaded");
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, dismiss: () => setError(null), download };
}

function when(iso: string | null): string | null {
  return iso ? formatStaffDateTime(iso, { zoneLabel: true }) : null;
}

/**
 * An onsite event: its dates, venue and linked sale, the venue-day counts, and the guest list.
 * Check-in is the next step in the event's life, so it leads the actions.
 */
export function OnsiteEventDetail({
  event,
  rsvps,
  venueDayCounts = null,
  linkedSaleTitle = null,
  loadError = null,
}: Props) {
  const exportCsv = useGuestListExport(event.slug);
  const status = staffStatus("onsiteEvent", event.status);
  const arrived = rsvps.filter((row) => row.checkedInAt !== null).length;
  const eventHref = `/admin/event-rsvps/${encodeURIComponent(event.slug)}`;

  const actions: OverflowAction[] = [
    {
      id: "export",
      label: exportCsv.busy ? "Preparing the file…" : "Download guest list (CSV)",
      icon: Download,
      onSelect: () => void exportCsv.download(),
      ...(exportCsv.busy ? { disabledReason: "The file is being prepared" } : {}),
    },
    ...(event.micrositeUrl
      ? [
          {
            id: "rsvp-page",
            label: "Open guest RSVP page",
            icon: ExternalLink,
            onSelect: () =>
              window.open(`${event.micrositeUrl}#rsvp`, "_blank", "noopener,noreferrer"),
          },
        ]
      : []),
    ...(event.saleId
      ? [
          {
            id: "sale-check-in",
            label: "Open sale check-in",
            href: `/admin/sales/${encodeURIComponent(event.saleId)}/registrations#check-in`,
          },
          {
            id: "saleroom",
            label: "Open saleroom console",
            href: `/admin/saleroom/${encodeURIComponent(event.saleId)}`,
          },
        ]
      : []),
  ];

  const stats: StatItem[] = venueDayCounts
    ? [
        { id: "rsvped", label: "RSVPs", value: venueDayCounts.rsvped },
        { id: "gala", label: "Checked in at the event", value: venueDayCounts.galaCheckedIn },
        { id: "sale", label: "Present at the sale", value: venueDayCounts.salePresent },
        { id: "paddled", label: "Paddles issued", value: venueDayCounts.paddled },
      ]
    : [
        { id: "rsvps", label: "RSVPs", value: rsvps.length },
        { id: "arrived", label: "Arrived", value: arrived },
        { id: "pending", label: "Not arrived", value: rsvps.length - arrived },
      ];

  const summary: KeyValueItem[] = [
    { label: "RSVPs close", value: when(event.rsvpCloseAt) },
    { label: "Dress code", value: event.dressCode },
    { label: "Arrival note", value: event.arrivalNote },
    {
      label: "Linked sale",
      value: event.saleId ? (
        <Link href={`/admin/sales/${encodeURIComponent(event.saleId)}`} className={LINK_CLASS}>
          {linkedSaleTitle ?? "Open linked sale"}
        </Link>
      ) : null,
    },
    { label: "Ways to attend", value: event.segmentOptions.map((o) => o.label).join(", ") },
    {
      label: "Check-in",
      value: event.checkInDryRun
        ? "Dry run: arrivals are checked but not recorded"
        : "Live: arrivals are recorded",
    },
    {
      label: "Ops email",
      value: event.opsEmail ? (
        <a href={`mailto:${event.opsEmail}`} className={LINK_CLASS}>
          {event.opsEmail}
        </a>
      ) : null,
    },
    {
      label: "Microsite",
      value: event.micrositeUrl ? (
        <a
          href={event.micrositeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          {event.micrositeUrl}
        </a>
      ) : null,
    },
    { label: "Event ID", value: event.slug, copyValue: event.slug },
  ];

  const notices = (
    <>
      {loadError ? (
        <Notice tone="danger" alert title="The guest list did not load">
          {loadError}
        </Notice>
      ) : null}
      {exportCsv.error ? (
        <Notice
          tone="danger"
          alert
          title="The guest list was not downloaded"
          actions={
            <StaffButton size="sm" onClick={exportCsv.dismiss}>
              Dismiss
            </StaffButton>
          }
        >
          {exportCsv.error}
        </Notice>
      ) : null}
      {event.checkInDryRun ? (
        <Notice tone="warning" title="Check-in is in dry run">
          Scans are checked but not recorded. Go live from the check-in page when the door opens.
        </Notice>
      ) : null}
    </>
  );

  return (
    <DetailPage
      breadcrumbs={
        <StaffBreadcrumbs
          items={[{ label: "Event RSVPs", href: "/admin/event-rsvps" }, { label: event.title }]}
        />
      }
      title={event.title}
      status={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
      meta={
        <>
          {event.startsAt ? <MetaItem label="Starts">{when(event.startsAt)}</MetaItem> : null}
          {event.venue ? <MetaItem label="Venue">{event.venue}</MetaItem> : null}
          <MetaItem label="Arrived">
            {arrived} of {rsvps.length}
          </MetaItem>
        </>
      }
      primaryAction={
        <StaffButton asChild variant="primary" icon={<ScanLine aria-hidden />}>
          <Link href={`${eventHref}/check-in`}>Open check-in</Link>
        </StaffButton>
      }
      secondaryActions={
        <StaffButton asChild variant="secondary" icon={<Pencil aria-hidden />}>
          <Link href={`${eventHref}/edit`}>Edit event</Link>
        </StaffButton>
      }
      overflow={<OverflowMenu actions={actions} Link={Link} />}
      summary={summary}
      notice={notices}
    >
      <StatGrid label="Event day counts" items={stats} />
      <OnsiteEventGuestList slug={event.slug} rsvps={rsvps} segmentOptions={event.segmentOptions} />
    </DetailPage>
  );
}

/** The event could not be loaded: its place in the list stays, with Try again. */
export function OnsiteEventUnavailable({ message }: { message: string }) {
  const router = useRouter();
  return (
    <DetailPage
      breadcrumbs={
        <StaffBreadcrumbs
          items={[{ label: "Event RSVPs", href: "/admin/event-rsvps" }, { label: "Event" }]}
        />
      }
      title="Event"
      error={{
        title: "This event did not load",
        description: message,
        onRetry: () => router.refresh(),
      }}
    />
  );
}
