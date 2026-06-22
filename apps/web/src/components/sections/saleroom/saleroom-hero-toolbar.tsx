"use client";

import { ShareButton } from "@/components/marketing/share-button";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";

type Props = {
  shareUrl: string;
  /** Passed to Web Share API / clipboard (not shown in the text row). */
  shareTitle: string;
};

const utilityButtonClass = cn(
  "inline-flex min-h-11 items-center gap-2 rounded-none px-0 font-label text-sm font-medium uppercase leading-[21px] text-on-surface-variant hover:bg-transparent hover:text-on-surface",
  FOCUS_RING,
);

/** Share utility for the editorial hero sidebar. */
export function SaleroomHeroToolbar({ shareUrl, shareTitle }: Props) {
  return (
    <nav aria-label="Sale actions" className="flex flex-col items-start gap-2">
      <ShareButton
        url={shareUrl}
        title={shareTitle}
        appearance="text"
        className={utilityButtonClass}
      />
    </nav>
  );
}
