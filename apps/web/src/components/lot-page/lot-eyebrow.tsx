"use client";

import { useLotPageViewContext } from "@/components/lot-page/lot-page-view-context";
import { StatusBadge } from "@auction/ui/lax";

/** "Lot 4" and the lifecycle badge. A live lot wears the neutral badge with the live dot. */
export function LotEyebrow({ lotNumber }: { lotNumber: number | null }) {
  const { badge } = useLotPageViewContext().view;
  return (
    <div className="flex flex-wrap items-center gap-2 text-lax-13 leading-5 font-medium text-lax-muted">
      {lotNumber !== null ? <span>Lot {lotNumber}</span> : null}
      <StatusBadge
        tone={badge.tone}
        live={badge.dot && badge.tone === "neutral"}
        {...(badge.dot ? { shape: "dot" as const } : {})}
      >
        {badge.label}
      </StatusBadge>
    </div>
  );
}
