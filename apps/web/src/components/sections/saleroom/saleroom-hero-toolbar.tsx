"use client";

import { ShareButton } from "@/components/marketing/share-button";
import { SaleroomPrintButton } from "@/components/sections/saleroom/saleroom-print-button";
import { Calendar } from "lucide-react";
import Link from "next/link";

type Props = {
  shareUrl: string;
  /** Passed to Web Share API / clipboard (not shown in the text row). */
  shareTitle: string;
};

const linkClass =
  "inline-flex h-10 items-center gap-1.5 font-['DM_Sans',sans-serif] text-sm font-medium uppercase leading-[21px] text-white/80 transition-colors hover:text-white";

/**
 * Upcoming (→ sales list) lives on its own row; Share / Print are grouped below.
 */
export function SaleroomHeroToolbar({ shareUrl, shareTitle }: Props) {
  return (
    <div className="flex flex-col items-start gap-2 lg:items-end">
      <Link href="/sales" className={linkClass}>
        <Calendar className="size-5 shrink-0 text-white/80" aria-hidden />
        Upcoming Auctions
      </Link>
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <div className="inline-flex h-10 items-center">
          <ShareButton url={shareUrl} title={shareTitle} appearance="text" />
        </div>
        <div className="inline-flex h-10 items-center">
          <SaleroomPrintButton appearance="text" />
        </div>
      </div>
    </div>
  );
}
