"use client";

import { AdminSaleroomHubBoard } from "@/components/admin/saleroom-hub-board";
import { SaleroomHubLiveGrid } from "@/components/admin/saleroom-hub-board/saleroom-hub-live-grid";
import type { SaleroomHubPageModel } from "@/lib/admin/saleroom/load-saleroom-hub-page";
import {
  EmptyState,
  type Metric,
  MetricStrip,
  Notice,
  type OverflowAction,
  OverflowMenu,
  PageHeader,
  StaffButton,
} from "@auction/staff-ui";
import { CalendarClock, DoorOpen, Radio } from "lucide-react";
import Link from "next/link";

const count = new Intl.NumberFormat("en-GB");

const MORE_LINKS: OverflowAction[] = [
  { id: "rsvps", label: "Event RSVPs", href: "/admin/event-rsvps" },
  { id: "attention", label: "Lots needing attention", href: "/admin/lots?lens=attention" },
];

function hubMetrics(summary: SaleroomHubPageModel["summary"]): Metric[] {
  return [
    {
      id: "live",
      label: "Live rooms",
      value: count.format(summary.liveCount),
      icon: <Radio aria-hidden className="size-3.5" />,
    },
    {
      id: "scheduled",
      label: "Scheduled",
      value: count.format(summary.scheduledCount),
      icon: <CalendarClock aria-hidden className="size-3.5" />,
    },
    {
      id: "available",
      label: "Consoles to open",
      value: count.format(summary.availableCount),
      icon: <DoorOpen aria-hidden className="size-3.5" />,
    },
  ];
}

/**
 * The saleroom hub: the rooms that are running or about to, with the sales still to come under
 * them. Live rooms update in place; each card opens that sale's clerk console or its check-in.
 */
export function SaleroomHubView({ model }: { model: SaleroomHubPageModel }) {
  const { summary, hubView, loadError } = model;
  const rooms = hubView?.summaries ?? [];
  const scheduled = hubView?.scheduledOnlyRows ?? [];
  const noSplit = hubView != null && rooms.length === 0 && scheduled.length === 0;
  const nothing = !loadError && summary.availableCount === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Saleroom"
        description="Run the floor for live sales, or open a sale's console to check bidders in."
        secondaryActions={
          <StaffButton asChild variant="secondary">
            <Link href="/admin/sales">All sales</Link>
          </StaffButton>
        }
        overflow={<OverflowMenu actions={MORE_LINKS} Link={Link} />}
      />

      {loadError ? (
        <Notice tone="danger" alert title="Could not load sales">
          {loadError}
        </Notice>
      ) : (
        <MetricStrip
          label="Saleroom summary"
          period="Sales with a room, right now"
          items={hubMetrics(summary)}
          Link={Link}
        />
      )}

      {nothing ? (
        <div className="rounded-staff-lg border border-staff-line bg-staff-surface">
          <EmptyState
            title="No live or upcoming sales"
            description="Schedule or activate a sale to open its clerk console."
            action={
              <StaffButton asChild variant="primary">
                <Link href="/admin/sales">Go to sales</Link>
              </StaffButton>
            }
          />
        </div>
      ) : null}

      {!loadError && rooms.length > 0 && hubView ? (
        <SaleroomHubLiveGrid rows={rooms} initialSessions={hubView.initialSessions} />
      ) : null}

      {!loadError && scheduled.length > 0 ? (
        <section aria-labelledby="scheduled-title" className="flex flex-col gap-3">
          <h2 id="scheduled-title" className="text-staff-md font-semibold text-staff-fg">
            Scheduled sales
          </h2>
          <AdminSaleroomHubBoard rows={scheduled} label="Scheduled sales" />
        </section>
      ) : null}

      {!loadError && noSplit && summary.availableCount > 0 && hubView ? (
        <AdminSaleroomHubBoard rows={hubView.rows} />
      ) : null}
    </div>
  );
}
