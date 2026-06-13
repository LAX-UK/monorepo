"use client";

import { ShareButton } from "@/components/marketing/share-button";
import { SaleroomPrintButton } from "@/components/sections/saleroom/saleroom-print-button";
import { useOverlayTone } from "@/components/ui/overlay-tone-context";
import { overlayTextMutedClasses, overlayToneProps } from "@/lib/ui/overlay-tone-classes";
import { cn } from "@auction/ui";
import { Calendar } from "lucide-react";
import Link from "next/link";

type Props = {
  shareUrl: string;
  /** Passed to Web Share API / clipboard (not shown in the text row). */
  shareTitle: string;
};

/** Upcoming (→ sales list) lives on its own row; Share / Print are grouped below.
 */
export function SaleroomHeroToolbar({ shareUrl, shareTitle }: Props) {
  const tone = useOverlayTone("contentBlock");
  const toneProps = overlayToneProps(tone);
  const linkClass = cn(
    "inline-flex h-10 items-center gap-1.5 font-label text-sm font-medium uppercase leading-[21px] transition-opacity hover:opacity-100",
    overlayTextMutedClasses(tone),
    "hover:text-[color:var(--overlay-fg)]",
  );
  const iconClass = cn("size-5 shrink-0 stroke-current", overlayTextMutedClasses(tone));
  const controlClass = cn(
    "inline-flex h-10 items-center gap-1.5 rounded-none px-0 font-label text-sm font-medium uppercase leading-[21px] hover:bg-transparent hover:opacity-100",
    overlayTextMutedClasses(tone),
    "hover:text-[color:var(--overlay-fg)]",
  );

  return (
    <div className="flex flex-col items-start gap-2 lg:items-end" {...toneProps}>
      <Link href="/sales" className={linkClass}>
        <Calendar className={iconClass} aria-hidden />
        Upcoming Auctions
      </Link>
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <div className="inline-flex h-10 items-center">
          <ShareButton
            url={shareUrl}
            title={shareTitle}
            appearance="text"
            className={controlClass}
          />
        </div>
        <div className="inline-flex h-10 items-center">
          <SaleroomPrintButton appearance="text" className={controlClass} />
        </div>
      </div>
    </div>
  );
}
