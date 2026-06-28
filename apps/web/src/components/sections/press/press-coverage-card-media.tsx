"use client";

import { PressMentionTypePlaceholder } from "@/components/illustrations/press-type-placeholders";
import type { PressCoverageVM } from "@/components/sections/saleroom/view-models";
import { MARKETING_CARD_MEDIA_HOVER } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import { useState } from "react";

type Props = {
  imageUrl: string | null;
  mentionType: PressCoverageVM["mentionType"];
  outletName: string;
  headline: string;
  className?: string;
};

export function PressCoverageCardMedia({
  imageUrl,
  mentionType,
  outletName,
  headline,
  className,
}: Props) {
  const [failed, setFailed] = useState(false);
  const showPlaceholder = !imageUrl || failed;

  return (
    <div
      className={cn(
        "relative aspect-video overflow-hidden border-b border-border-hairline bg-surface-container-low",
        className,
      )}
    >
      {showPlaceholder ? (
        <PressMentionTypePlaceholder mentionType={mentionType} label={outletName} />
      ) : (
        // External publisher URLs — native img avoids Next remotePatterns churn.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={cn("h-full w-full object-cover", MARKETING_CARD_MEDIA_HOVER)}
        />
      )}
      <span className="sr-only">{headline}</span>
    </div>
  );
}
