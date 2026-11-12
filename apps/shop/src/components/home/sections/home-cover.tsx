"use client";

import { SHOP_HOME_CONTENT } from "@/content/home/shop-home-content";
import { type ShopCoverPlate, toShopCoverSlide } from "@/lib/home/home-cover.adapter";
import type { HomeHeroVm } from "@/lib/home/home-page.vm";
import { shopCoverSrcSet } from "@/lib/media/shop-cover-src-set";
import { type CoverPhotoMedia, MarketingCover } from "@auction/marketing-ui";
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
  staffCover = null,
}: {
  hero: HomeHeroVm;
  plate: ShopCoverPlate | null;
  catalogueFailed: boolean;
  /** The picture staff chose for the cover; the newest edition's plate leads without one. */
  staffCover?: CoverPhotoMedia | null;
}) {
  const slides = useMemo(
    () => [toShopCoverSlide(hero, { plate, catalogueFailed, staffCover })],
    [hero, plate, catalogueFailed, staffCover],
  );
  return (
    <MarketingCover
      slides={slides}
      label={SHOP_HOME_CONTENT.hero.coverLabel}
      Link={Link}
      srcSetFor={shopCoverSrcSet}
      priority
    />
  );
}
