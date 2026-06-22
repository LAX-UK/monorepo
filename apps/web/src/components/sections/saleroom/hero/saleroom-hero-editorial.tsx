"use client";

import { MarketingMobileBackLink } from "@/components/marketing/marketing-mobile-back-link";
import { resolveSaleroomHeroLiveTrailing } from "@/components/sections/saleroom/hero/saleroom-hero-copy";
import { SaleroomHeroCoverMedia } from "@/components/sections/saleroom/hero/saleroom-hero-cover-media";
import { SaleroomHeroMetaRow } from "@/components/sections/saleroom/hero/saleroom-hero-meta-row";
import { SaleroomHeroSidebar } from "@/components/sections/saleroom/hero/saleroom-hero-sidebar";
import { SaleroomHeroStatsRow } from "@/components/sections/saleroom/hero/saleroom-hero-stats-row";
import { SaleroomHeroTimingBlock } from "@/components/sections/saleroom/hero/saleroom-hero-timing-block";
import type { SaleHeroVM } from "@/components/sections/saleroom/view-models";
import { useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import type { SaleFormatExplainerContext } from "@/lib/sale-format-explainer";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import type { SaleDeliveryMode } from "@auction/types";
import { DisplayHeading } from "@auction/ui";
import type { ReactNode } from "react";

type Props = {
  hero: SaleHeroVM;
  toolbar: ReactNode;
  actions: ReactNode;
  backHref?: string;
  backLabel?: string;
  deliveryMode?: SaleDeliveryMode;
  catalogLotRefs?: Array<{ id: string; lotNumber: number | null; title: string }>;
  saleroomSession?: PublicSaleroomSessionStatus | null;
  coverBlurDataURL?: string | null;
  saleStartsSoon?: boolean;
  showOnlineBiddingGatedBadge?: boolean;
  explainerContext?: SaleFormatExplainerContext;
};

export function SaleroomHeroEditorial({
  hero,
  toolbar,
  actions,
  backHref,
  backLabel = "Back to calendar",
  deliveryMode = "online",
  catalogLotRefs = [],
  saleroomSession = null,
  coverBlurDataURL = null,
  saleStartsSoon = false,
  showOnlineBiddingGatedBadge = false,
  explainerContext,
}: Props) {
  const saleroomLive = useSaleroomLive();
  const liveSession: PublicSaleroomSessionStatus | null = saleroomLive ?? saleroomSession ?? null;
  const liveTrailing = resolveSaleroomHeroLiveTrailing(hero, {
    liveSession,
    catalogLotRefs,
  });

  return (
    <header className={MARKETING_PAGE_SHELL}>
      <div className="flex flex-col gap-6 pb-10 pt-6 md:gap-8 md:pb-14 md:pt-8">
        {backHref ? (
          <MarketingMobileBackLink href={backHref} label={backLabel} variant="default" />
        ) : null}

        <SaleroomHeroMetaRow
          hero={hero}
          liveTrailing={liveTrailing}
          deliveryMode={deliveryMode}
          startsSoon={saleStartsSoon}
          showOnlineBiddingGatedBadge={showOnlineBiddingGatedBadge}
          {...(explainerContext ? { explainerContext } : {})}
        />

        <DisplayHeading as="h1" size="lg" className="fade-up-d1 text-balance font-semibold">
          {hero.title}
        </DisplayHeading>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start lg:gap-10">
          <SaleroomHeroCoverMedia
            coverImage={hero.coverImage}
            title={hero.title}
            blurDataURL={coverBlurDataURL}
          />
          <SaleroomHeroSidebar
            timing={<SaleroomHeroTimingBlock hero={hero} />}
            stats={<SaleroomHeroStatsRow hero={hero} />}
            toolbar={toolbar}
            actions={actions}
          />
        </div>
      </div>
    </header>
  );
}
