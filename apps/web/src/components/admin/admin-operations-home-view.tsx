"use client";

import { AdminFinanceKpiRows } from "@/components/admin/admin-finance-kpi-rows";
import { AdminLiveBidActivity } from "@/components/admin/admin-live-bid-activity";
import { StaffWhatsNewBanner } from "@/components/admin/staff-whats-new-banner";
import { AttentionList } from "@/components/dashboard/attention-list";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import { Button } from "@/components/ui/button";
import type {
  AdminFinanceIssuesPayload,
  AdminTodayMetricsPayload,
} from "@/lib/data/http/admin.server";
import { LabelCaps } from "@auction/ui";
import { CompareDelta, EntityList, StatusBadge, Button as UiButton } from "@auction/ui";
import { Surface } from "@auction/ui/components/surface";
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
  /** Mockup-aligned status chip; renders with `StatusBadge` when present. */
  statusLabel?: string;
  statusTone?: "live" | "neutral" | "warning" | "success";
  /** Mockup-aligned price column; renders next to the status when present. */
  priceLabel?: string;
  /** Mockup-aligned ends column; renders right-aligned next to the action. */
  endsLabel?: string;
};

type Props = {
  metrics: AdminTodayMetricsPayload;
  bidsPerMinute: number;
  activeLotIds: readonly string[];
  attention: AdminAttentionRow[];
  activity: AdminActivityRow[];
  /** Failed payouts and Stripe Connect requirement backlog; null when the metrics API call failed. */
  financeIssues: AdminFinanceIssuesPayload | null;
};

export function AdminOperationsHomeView({
  metrics,
  bidsPerMinute,
  activeLotIds,
  attention,
  activity,
  financeIssues,
}: Props) {
  return (
    <div className="space-y-10">
      <StaffWhatsNewBanner />
      <DashboardPageHeader
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

      <KpiRow
        variant="hero"
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

      {financeIssues ? <AdminFinanceKpiRows financeIssues={financeIssues} /> : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section
          className={
            activeLotIds.length === 0 ? "space-y-4 lg:col-span-8" : "space-y-4 lg:col-span-7"
          }
        >
          <h2 className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Needs your attention
          </h2>
          <AttentionList items={attention} />
        </section>

        <aside
          className={
            activeLotIds.length === 0 ? "space-y-4 lg:col-span-4" : "space-y-4 lg:col-span-5"
          }
        >
          <Surface variant="section" padding="md" className="space-y-4 border-border-hairline">
            <div className="space-y-1">
              <h3 className="font-headline text-lg font-semibold text-on-surface">Live saleroom</h3>
              <p className="font-body text-sm text-on-surface-variant">
                Redis 1m counter plus room pulse on active lots.
              </p>
            </div>
            <AdminLiveBidActivity
              initialBidsPerMinute={bidsPerMinute}
              activeLotIds={activeLotIds}
            />
          </Surface>
        </aside>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Recent activity
          </h2>
          <Button variant="ctaLink" asChild>
            <Link href="/admin/lots" className="inline-flex items-center gap-1">
              View all
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
        <EntityList
          responsiveMode="auto"
          table={
            <div className="hidden overflow-x-auto rounded-md border border-border-hairline md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border-hairline bg-surface-container-low/50 font-label text-xs uppercase tracking-wider text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Ends</th>
                    <th className="px-4 py-3 text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((r) => (
                    <tr key={r.id} className="border-b border-border-hairline">
                      <td className="px-4 py-3 font-medium text-on-surface">{r.title}</td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {r.statusLabel ? (
                          <StatusBadge variant={r.statusTone ?? "neutral"} size="sm">
                            {r.statusLabel}
                          </StatusBadge>
                        ) : (
                          <span>{r.meta}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-on-surface">{r.priceLabel ?? "\u2014"}</td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {r.endsLabel ?? (r.statusLabel ? "\u2014" : "")}
                      </td>
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
                    className="flex min-h-11 flex-col gap-1 rounded-sm border border-border-hairline bg-surface-container-low/30 p-3 transition-colors hover:bg-surface-container-high/50"
                  >
                    <span className="font-headline text-sm text-on-surface">{r.title}</span>
                    {r.statusLabel || r.priceLabel || r.endsLabel ? (
                      <span className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                        {r.statusLabel ? (
                          <StatusBadge variant={r.statusTone ?? "neutral"} size="sm">
                            {r.statusLabel}
                          </StatusBadge>
                        ) : null}
                        {r.priceLabel ? <span>{r.priceLabel}</span> : null}
                        {r.endsLabel ? <span>{r.endsLabel}</span> : null}
                      </span>
                    ) : (
                      <span className="text-xs text-on-surface-variant">{r.meta}</span>
                    )}
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
