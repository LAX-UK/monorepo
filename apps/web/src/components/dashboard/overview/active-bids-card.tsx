import { BidPlacementBadge } from "@/components/dashboard/bid-placement-badge";
import { LotThumbnail } from "@/components/dashboard/overview/lot-thumbnail";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { DashboardLotCountdown } from "@/components/dashboard/primitives/dashboard-lot-countdown";
import { DASHBOARD_CTA, DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { formatMoney, resolveLotCurrency } from "@/lib/format-currency";
import { bidHintDotStatus } from "@/lib/presenters/status/bid-board-dot-status";
import { lotPath } from "@/lib/seo/url";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { Surface } from "@auction/ui/components/surface";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

function bidHintBadge(hint: "high" | "outbid" | "none") {
  if (hint === "none") return null;
  const presentation = bidHintDotStatus(hint);
  return <DotStatusPill label={presentation.label} tone={presentation.tone} />;
}

export function ActiveBidsCard({ vm }: { vm: DashboardOverviewVm }) {
  const activeBidLots = vm.activeBidLots;

  return (
    <Surface variant="section" padding="md" className="space-y-4 border-border-hairline">
      <div className="flex flex-row items-center justify-between gap-4">
        <div>
          <h2 className="font-headline text-xl font-semibold tracking-tight text-on-surface md:text-2xl">
            Active bids
          </h2>
          <p className="font-body text-sm text-on-surface-variant">
            Lots where your latest bid is still in play.
          </p>
        </div>
        <Button variant="chevron" asChild>
          <Link href="/dashboard/bids" className="inline-flex items-center gap-1 text-xs">
            View bids
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
      <div>
        {activeBidLots.length === 0 ? (
          <DashboardEmptyState
            variant="quiet"
            title={DASHBOARD_EMPTY.bids.title}
            description={DASHBOARD_EMPTY.bids.description}
            action={
              <Button size="sm" variant="outline" asChild className="shrink-0">
                <Link href="/search?status=active">{DASHBOARD_CTA.browseLiveAuctions}</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-outline-variant/10">
            {activeBidLots.slice(0, 5).map((entry) => {
              const { lot, bid, hint } = entry;
              return (
                <li key={lot.id}>
                  <Link
                    href={lotPath(lot)}
                    className="grid gap-3 py-4 transition-colors hover:bg-surface-container-low/45 sm:grid-cols-[1fr_auto] sm:items-center sm:px-2"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <LotThumbnail
                        src={lot.images[0]}
                        alt={`${lot.title} thumbnail`}
                        className="size-14 rounded-lg"
                        sizes="56px"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-label text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">
                          {lot.lotNumber ? `Lot ${lot.lotNumber}` : "Lot"}{" "}
                          {lot.medium ? `· ${lot.medium}` : ""}
                        </span>
                        <span className="block truncate font-headline text-sm font-semibold text-on-surface">
                          {lot.title}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2">
                          <span
                            key={hint === "high" ? bid.amount : lot.currentPrice}
                            className="tick-value font-label text-xs uppercase tracking-wider text-secondary"
                          >
                            {hint === "high" ? "My bid" : "Current"}{" "}
                            {formatMoney(
                              hint === "high" ? bid.amount : lot.currentPrice,
                              resolveLotCurrency(lot),
                            )}
                          </span>
                          {bidHintBadge(hint)}
                          <BidPlacementBadge bid={bid} />
                        </span>
                      </span>
                    </span>
                    <span className="justify-self-start sm:justify-self-end">
                      <DashboardLotCountdown
                        status={lot.status}
                        startTime={lot.startTime}
                        endTime={lot.endTime}
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Surface>
  );
}
