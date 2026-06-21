import { SaleScheduleBadges } from "@/components/marketing/sale-status-badge";
import { SaleTypeBadge } from "@/components/marketing/sale-type-badge";
import type { HomeUpcomingAuctionTileVM } from "@/components/sections/home/home-view-models";
import { SaleCardActions } from "@/components/sections/sales/card/sale-card-actions";
import { SaleCardMedia } from "@/components/sections/sales/card/sale-card-media";
import { SaleCardMeta } from "@/components/sections/sales/card/sale-card-meta";
import {
  SALE_CARD_SHELL_CLASSNAME,
  SaleCardShell,
} from "@/components/sections/sales/card/sale-card-shell";
import { SaleCardTitle } from "@/components/sections/sales/card/sale-card-title";
import type { SaleAction } from "@/components/sections/sales/card/types";
import { formatSaleItemsLabel } from "@/lib/sale-list-row";
import { cn } from "@auction/ui";
import Link from "next/link";

type Props = {
  tile: HomeUpcomingAuctionTileVM;
  variant: "grid" | "list";
  isAuthenticated: boolean;
};

function buildActions(tile: HomeUpcomingAuctionTileVM, isAuthenticated: boolean): SaleAction[] {
  const actions: SaleAction[] = [];
  if (!isAuthenticated && (tile.status === "scheduled" || tile.status === "active")) {
    actions.push({
      id: "register",
      label: "Register to bid",
      href: "/register",
      variant: "outline",
    });
  }
  actions.push({
    id: "lots",
    label: "View lots",
    href: tile.href,
    variant: "cta",
  });
  return actions;
}

export function UpcomingAuctionMarketingCard({ tile, variant, isAuthenticated }: Props) {
  const itemsLabel = formatSaleItemsLabel(tile.lotCount);
  const isLive = Boolean(tile.isLive);
  const mediaCommon = {
    href: tile.href,
    coverImageUrl: tile.coverImageUrl,
    coverImageAlt: tile.coverImageAlt,
    isLive,
    ...(tile.countdownEndIso != null ? { countdownEndIso: tile.countdownEndIso } : {}),
  };

  if (variant === "grid") {
    return (
      <article className="flex h-full min-w-0 flex-col">
        <Link
          href={tile.href}
          className={cn(
            SALE_CARD_SHELL_CLASSNAME,
            "flex h-full min-h-0 flex-col gap-3 motion-safe:ease-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page-bg",
          )}
        >
          <SaleCardMedia
            {...mediaCommon}
            linkMode="none"
            layout="featured"
            imageRoundedClassName="rounded"
            scrimClassName="rounded bg-black/20"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <SaleScheduleBadges
              isLive={Boolean(tile.isLive)}
              startsSoon={Boolean(tile.startsSoon)}
            />
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <SaleTypeBadge deliveryMode={tile.deliveryMode} size="sm" isLive={isLive} />
              <div className="flex min-h-[1.25em] items-center border-l border-on-surface-variant/20 pl-2.5">
                <span className="font-body text-xs font-normal uppercase text-on-surface-variant">
                  {tile.dateLabel}
                </span>
              </div>
              {tile.locationLabel && (
                <div className="flex min-h-[1.25em] items-center border-l border-on-surface-variant/20 pl-2.5">
                  <span className="font-body text-xs font-normal uppercase text-on-surface-variant">
                    {tile.locationLabel}
                  </span>
                </div>
              )}
            </div>
            <SaleCardTitle mode="embedded" title={tile.title} className="line-clamp-2" />
            <SaleCardMeta itemsLabel={itemsLabel} />
          </div>
        </Link>
      </article>
    );
  }

  return (
    <SaleCardShell className="p-3 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-stretch lg:gap-6">
        <SaleCardMedia
          {...mediaCommon}
          linkMode="area"
          layout="calendarRow"
          sizes="(max-width: 1024px) 100vw, 420px"
          className="max-h-[11rem] sm:max-h-none"
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-6 lg:gap-8">
          <div className="flex flex-col gap-4">
            <SaleScheduleBadges
              isLive={Boolean(tile.isLive)}
              startsSoon={Boolean(tile.startsSoon)}
            />
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <SaleTypeBadge deliveryMode={tile.deliveryMode} size="sm" isLive={isLive} />
                <div className="flex min-h-[1.25em] items-center border-l border-on-surface-variant/20 pl-2.5">
                  <span className="font-body text-xs font-normal uppercase text-on-surface-variant sm:text-sm">
                    {tile.dateLabel}
                  </span>
                </div>
                {tile.locationLabel && (
                  <div className="flex min-h-[1.25em] items-center border-l border-on-surface-variant/20 pl-2.5">
                    <span className="font-body text-xs font-normal uppercase text-on-surface-variant sm:text-sm">
                      {tile.locationLabel}
                    </span>
                  </div>
                )}
              </div>
              <p className="font-body text-xs font-normal uppercase leading-snug text-on-surface-variant sm:text-sm">
                {itemsLabel}
              </p>
            </div>
            <SaleCardTitle href={tile.href} title={tile.title} />
          </div>
          <SaleCardActions actions={buildActions(tile, isAuthenticated)} />
        </div>
      </div>
    </SaleCardShell>
  );
}
