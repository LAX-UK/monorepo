"use client";

import { SHOP_HOME_CONTENT } from "@/content/home/shop-home-content";
import { type ShopCoverPlate, toShopCoverSlide } from "@/lib/home/home-cover.adapter";
import type { HomeHeroVm } from "@/lib/home/home-page.vm";
import { MarketingCover } from "@auction/marketing-ui";
import Link from "next/link";
import { useMemo } from "react";

/**
 * The first screen: the release as a plate on a pale field taken from its print, or type when
 * the print cannot be shown. One title, one line of fact, one action and one link.
 */
export function HomeCover({
  hero,
  plate,
  catalogueFailed,
}: {
  hero: HomeHeroVm;
  plate: ShopCoverPlate | null;
  catalogueFailed: boolean;
}) {
  const slides = useMemo(
    () => [toShopCoverSlide(hero, { plate, catalogueFailed })],
    [hero, plate, catalogueFailed],
  );
  return (
    <MarketingCover
      slides={slides}
      label={SHOP_HOME_CONTENT.hero.coverLabel}
      Link={Link}
      priority
    />
  );
}
