"use client";

import { AdminLiveBidActivity } from "@/components/admin/admin-live-bid-activity";
import { AttentionList } from "@/components/dashboard/attention-list";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { Button } from "@/components/ui/button";
import type { AdminTodayMetricsPayload } from "@/lib/data/http/admin.server";
import { LabelCaps } from "@auction/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CompareDelta,
  EntityTableShell,
  PageHeader,
  Button as UiButton,
} from "@auction/ui";
import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";

export type AdminAttentionRow = {
  id: string;
  title: string;
  hint: string;
  href: string;
  ctaLabel: string;
};

export type AdminActivityRow = {
  id: string;
  title: string;
  meta: string;
  href: string;
};

type Props = {
  metrics: AdminTodayMetricsPayload;
  bidsPerMinute: number;
  activeLotIds: readonly string[];
  attention: AdminAttentionRow[];
  activity: AdminActivityRow[];
};

export function AdminOperationsHomeView({
  metrics,
  bidsPerMinute,
  activeLotIds,
  attention,
  activity,
}: Props) {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Operations"
        meta={<LabelCaps className="text-lot-orange">Admin · Cockpit</LabelCaps>}
        description="Live saleroom health, intake queue, settlements, and recent catalog movement."
        actions={
          <Button variant="primary" asChild>
            <Link href="/admin/lots/new">
              <Plus className="size-4" aria-hidden />
              New lot
            </Link>
          </Button>
        }
      />

      <KpiGrid
        columns={6}
        className="xl:grid-cols-3"
        tiles={[
          {
            label: "Live lots",
            value: String(metrics.liveLots),
            delta: <CompareDelta label="Active now" tone="neutral" />,
            trendTone: "primary",
            emphasize: true,
          },
          {
            label: "Draft lots",
            value: String(metrics.draftLots),
            delta: <CompareDelta label="Catalog" tone="neutral" />,
            trendTone: "secondary",
          },
          {
            label: "Revenue today",
            value: metrics.revenueToday,
            delta: <CompareDelta label="Captured UTC" tone="positive" />,
            trendTone: "primary",
          },
          {
            label: "Pending submissions",
            value: String(metrics.pendingSubmissions),
            delta: <CompareDelta label="Review queue" tone="neutral" />,
            trendTone: "lot-orange",
          },
          {
            label: "Stale payments",
            value: String(metrics.stalePendingPayments),
            delta: <CompareDelta label="> 48h pending" tone="negative" />,
            trendTone: "live-red",
          },
          {
            label: "Bids/min",
            value: String(bidsPerMinute),
            delta: (
              <CompareDelta label={`${metrics.endingWithinHour} ending < 1h`} tone="neutral" />
            ),
            trendTone: "primary",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="space-y-4 lg:col-span-7">
          <h2 className="font-label text-xs font-bold uppercase tracking-widest text-secondary">
            Needs your attention
          </h2>
          <AttentionList items={attention} />
        </section>

        <aside className="space-y-4 lg:col-span-5">
          <Card className="border-outline-variant/15">
            <CardHeader>
              <CardTitle className="font-headline text-lg">Live saleroom</CardTitle>
              <CardDescription>Redis 1m counter plus room pulse on active lots.</CardDescription>
            </CardHeader>
            <CardContent>
              <AdminLiveBidActivity
                initialBidsPerMinute={bidsPerMinute}
                activeLotIds={activeLotIds}
              />
            </CardContent>
          </Card>
        </aside>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-label text-xs font-bold uppercase tracking-widest text-secondary">
            Recent activity
          </h2>
          <Button variant="ctaLink" asChild>
            <Link href="/admin/lots" className="inline-flex items-center gap-1">
              View all
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
        <EntityTableShell
          responsiveMode="auto"
          table={
            <div className="hidden overflow-x-auto rounded-md border border-outline-variant/15 md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-outline-variant/15 bg-surface-container-low/50 font-label text-xs uppercase tracking-wider text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Meta</th>
                    <th className="px-4 py-3 text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((r) => (
                    <tr key={r.id} className="border-b border-outline-variant/10">
                      <td className="px-4 py-3 font-medium text-on-surface">{r.title}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{r.meta}</td>
                      <td className="px-4 py-3 text-right">
                        <UiButton variant="chevron" size="sm" asChild>
                          <Link href={r.href} className="inline-flex items-center gap-1">
                            View
                            <ChevronRight className="size-4" aria-hidden />
                          </Link>
                        </UiButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
          cards={
            <ul className="space-y-3">
              {activity.map((r) => (
                <li key={r.id}>
                  <Link
                    href={r.href}
                    className="flex min-h-11 flex-col gap-1 rounded-sm border border-outline-variant/15 bg-surface-container-low/30 p-3 transition-colors hover:bg-surface-container-high/50"
                  >
                    <span className="font-headline text-sm text-on-surface">{r.title}</span>
                    <span className="text-xs text-on-surface-variant">{r.meta}</span>
                  </Link>
                </li>
              ))}
            </ul>
          }
        />
      </section>
    </div>
  );
}
