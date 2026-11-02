"use client";

import { type BidViewerSale, withBidViewer } from "@/lib/marketing-cover/bid-cover.adapter";
import type { BidCoverViewer } from "@/lib/marketing-cover/bid-cover.adapter";
import { fetchCoverViewer } from "@/lib/marketing-cover/cover-viewer.client";
import { HOME_COVER_LABEL, HOME_COVER_LINKS } from "@/lib/marketing-cover/home-cover-links";
import { type CoverSlide, MarketingCover } from "@auction/marketing-ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Props = {
  /** The slides as an anonymous visitor sees them; the page itself is the same for everyone. */
  slides: readonly CoverSlide[];
  /** The sale whose registration decides the signed-in swaps. */
  leadSale: (BidViewerSale & { id: string }) | null;
  signedIn: boolean;
};

/** Where the signed-in person stands with the lead sale, read once the page is on screen. */
function useCoverViewer(saleId: string | null, signedIn: boolean): BidCoverViewer {
  const [viewer, setViewer] = useState<BidCoverViewer>("anonymous");
  useEffect(() => {
    if (!signedIn || !saleId) return;
    const controller = new AbortController();
    void fetchCoverViewer(saleId, controller.signal).then((next) => {
      if (!controller.signal.aborted) setViewer(next);
    });
    return () => controller.abort();
  }, [saleId, signedIn]);
  return viewer;
}

/**
 * The home cover. The server draws it for everyone; for a signed-in person the status line and
 * the link on the lead sale change once their registration is known (approved, pending or
 * declined). Nothing else on the cover depends on who is looking.
 */
export function HomeCover({ slides, leadSale, signedIn }: Props) {
  const viewer = useCoverViewer(leadSale?.id ?? null, signedIn);
  const shown = useMemo(
    () =>
      leadSale && viewer !== "anonymous"
        ? slides.map((slide) =>
            slide.id === leadSale.id
              ? withBidViewer(slide, leadSale, viewer, HOME_COVER_LINKS)
              : slide,
          )
        : slides,
    [slides, leadSale, viewer],
  );
  return <MarketingCover slides={shown} label={HOME_COVER_LABEL} Link={Link} priority />;
}
