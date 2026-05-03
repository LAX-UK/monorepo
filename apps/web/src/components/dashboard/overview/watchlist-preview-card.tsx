import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { formatMoney } from "@/lib/format-currency";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
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
import Image from "next/image";
import Link from "next/link";

export function WatchlistPreviewCard({ vm }: { vm: DashboardOverviewVm }) {
  const items = vm.watchPreview.slice(0, 2).filter((row) => row.lot);

  return (
    <Card className="border-outline-variant/15 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="font-headline text-xl">Watchlist</CardTitle>
          <CardDescription>Saved lots you are tracking.</CardDescription>
        </div>
        <Button variant="chevron" asChild>
          <Link href="/dashboard/watchlist" className="inline-flex items-center gap-1 text-xs">
            View all
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            Save lots from artwork pages to build a personal watchlist.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-2">
            {items.map((row) => {
              const lot = row.lot;
              if (!lot) return null;
              return (
                <Link
                  key={row.watchlistId}
                  href={`/artwork/${lot.id}`}
                  className="group overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-lowest transition-colors hover:border-primary/25 hover:bg-surface-container-low"
                >
                  <div className="relative aspect-4/3 overflow-hidden bg-surface-container-high">
                    {lot.images[0] ? (
                      <Image
                        src={lot.images[0]}
                        alt={`${lot.title} thumbnail`}
                        fill
                        placeholder="blur"
                        blurDataURL={TINY_IMAGE_BLUR}
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, 240px"
                      />
                    ) : (
                      <ImagePlaceholder label="Lot artwork" />
                    )}
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="line-clamp-2 font-headline text-sm font-semibold text-on-surface">
                      {lot.title}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-label text-xs uppercase tracking-wider text-secondary">
                        Est. {formatMoney(lot.currentPrice)}
                      </span>
                      <StatusBadge variant={lot.status === "active" ? "live" : "neutral"}>
                        {lot.status}
                      </StatusBadge>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
