import { LotThumbnail } from "@/components/dashboard/overview/lot-thumbnail";
import { LotCardTimer } from "@/components/lot-timer";
import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { formatMoney } from "@/lib/format-currency";
import { Button } from "@auction/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

function bidHintBadge(hint: "high" | "outbid" | "none") {
  if (hint === "high") return <StatusBadge variant="success">High bidder</StatusBadge>;
  if (hint === "outbid") return <StatusBadge variant="danger">Outbid</StatusBadge>;
  return null;
}

export function ActiveBidsCard({ vm }: { vm: DashboardOverviewVm }) {
  const activeBidLots = vm.activeLots.filter((lot) => vm.activeLotBidHints[lot.id] !== "none");

  return (
    <Card className="border-outline-variant/15 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="font-headline text-xl">Active bids</CardTitle>
          <CardDescription>Lots where your latest bid is still in play.</CardDescription>
        </div>
        <Button variant="chevron" asChild>
          <Link href="/dashboard/bids" className="inline-flex items-center gap-1 text-xs">
            View bids
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {activeBidLots.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            No active bid positions right now. Browse live lots to place your next bid.
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant/10">
            {activeBidLots.slice(0, 5).map((lot) => {
              const hint = vm.activeLotBidHints[lot.id] ?? "none";
              return (
                <li key={lot.id}>
                  <Link
                    href={`/artwork/${lot.id}`}
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
                          <span className="font-label text-xs uppercase tracking-wider text-primary">
                            {hint === "high" ? "My bid" : "Current"} {formatMoney(lot.currentPrice)}
                          </span>
                          {bidHintBadge(hint)}
                        </span>
                      </span>
                    </span>
                    <span className="justify-self-start sm:justify-self-end">
                      <LotCardTimer
                        status={lot.status}
                        startTime={lot.startTime.toISOString()}
                        endTime={lot.endTime.toISOString()}
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
