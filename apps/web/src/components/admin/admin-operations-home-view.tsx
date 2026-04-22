"use client";

import { AdminLiveBidActivity } from "@/components/admin/admin-live-bid-activity";
import { Button } from "@/components/ui/button";
import type { AdminTodayMetricsPayload } from "@/lib/data/http/admin.server";
import { BodyText, LabelCaps } from "@auction/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CompareDelta,
  EntityTableShell,
  KpiTile,
  PageHeader,
  StatStrip,
  Button as UiButton,
} from "@auction/ui";
import { ChevronRight } from "lucide-react";
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
          <>
            <Button variant="primary" asChild>
              <Link href="/admin/lots/new">New lot</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/admin/lots">All lots</Link>
            </Button>
          </>
        }
      />

      <StatStrip className="gap-3">
        <KpiTile
          label="Live lots"
          value={String(metrics.liveLots)}
          delta={<CompareDelta label="Active now" tone="neutral" />}
          trendTone="primary"
          emphasize
        />
        <KpiTile
          label="Ending &lt; 1h"
          value={String(metrics.endingWithinHour)}
          delta={<CompareDelta label="Closings" tone="neutral" />}
          trendTone="lot-orange"
        />
        <KpiTile
          label="Draft lots"
          value={String(metrics.draftLots)}
          delta={<CompareDelta label="Catalog" tone="neutral" />}
          trendTone="secondary"
        />
        <KpiTile
          label="Submissions (review)"
          value={String(metrics.pendingSubmissions)}
          delta={<CompareDelta label="Queue" tone="neutral" />}
          trendTone="primary"
        />
        <KpiTile
          label="Stale payments"
          value={String(metrics.stalePendingPayments)}
          delta={<CompareDelta label="&gt; 48h pending" tone="negative" />}
          trendTone="live-red"
        />
        <KpiTile
          label="Revenue (UTC today)"
          value={metrics.revenueToday}
          delta={<CompareDelta label="Captured" tone="positive" />}
          trendTone="primary"
        />
      </StatStrip>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="space-y-4 lg:col-span-7">
          <h2 className="font-label text-xs font-bold uppercase tracking-widest text-secondary">
            Needs your attention
          </h2>
          {attention.length === 0 ? (
            <BodyText className="text-on-surface-variant">Nothing urgent right now.</BodyText>
          ) : (
            <ul className="space-y-2">
              {attention.map((row) => (
                <li
                  key={row.id}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-outline-variant/15 bg-surface-container-low/40 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-headline text-sm text-on-surface">{row.title}</p>
                    <p className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
                      {row.hint}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    className="shrink-0 text-xs uppercase tracking-widest"
                    asChild
                  >
                    <Link href={row.href}>{row.ctaLabel}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
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
        <h2 className="mb-4 font-label text-xs font-bold uppercase tracking-widest text-secondary">
          Recent activity
        </h2>
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
                    className="flex min-h-11 flex-col gap-1 rounded-lg border border-outline-variant/15 bg-surface-container-low/30 p-3 transition-colors hover:bg-surface-container-high/50"
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
