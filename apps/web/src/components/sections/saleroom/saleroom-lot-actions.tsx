import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import { Button } from "@auction/ui/components/button";
import { Gavel } from "lucide-react";
import Link from "next/link";

type Props = {
  lotId: string;
  isAuthenticated: boolean;
  /** Compact variant keeps the action bar inside 4-col cards without overflowing. */
  compact?: boolean;
};

/**
 * Per-lot actions slot. OCP: the lot card accepts any ReactNode as actions,
 * so callers can swap Bid/Watch for Results/Unavailable without forking the card.
 */
export function SaleroomLotActions({ lotId, isAuthenticated, compact = true }: Props) {
  const sizeClasses = compact
    ? "min-h-9 h-auto px-3 py-1.5 text-[0.7rem]"
    : "min-h-11 h-auto px-4 py-2 text-xs";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        asChild
        className={`${sizeClasses} gap-1 rounded-full font-label font-bold uppercase tracking-widest`}
      >
        <Link href={`/artwork/${lotId}`}>
          <Gavel className="size-3.5" aria-hidden />
          Bid
        </Link>
      </Button>
      <ArtworkWatchToggle lotId={lotId} initialWatching={false} isAuthenticated={isAuthenticated} />
    </div>
  );
}
