"use client";

import { useLotPageViewContext } from "@/components/lot-page/lot-page-view-context";
import { Skeleton } from "@auction/ui/lax/skeleton";
import { StatusBadge } from "@auction/ui/lax/status-badge";

/**
 * "Lot 4" and the lifecycle badge. A live lot wears the neutral badge with the live dot. Until the
 * first live read the badge is a placeholder: the lot's status is not in the page (CO-7).
 */
export function LotEyebrow({ lotNumber }: { lotNumber: number | null }) {
  const { live, view } = useLotPageViewContext();
  const { badge } = view;
  return (
    <div className="flex flex-wrap items-center gap-2 text-lax-13 leading-5 font-medium text-lax-muted">
      {lotNumber !== null ? <span>Lot {lotNumber}</span> : null}
      {!live ? (
        <Skeleton className="inline-block h-5 w-16" />
      ) : (
        <StatusBadge
          tone={badge.tone}
          live={badge.dot && badge.tone === "neutral"}
          {...(badge.dot ? { shape: "dot" as const } : {})}
        >
          {badge.label}
        </StatusBadge>
      )}
    </div>
  );
}
