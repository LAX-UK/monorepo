import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import { Button } from "@auction/ui/components/button";
import { Gavel } from "lucide-react";
import Link from "next/link";

type Props = {
  lotId: string;
  lotHref: string;
  isAuthenticated: boolean;
  initialWatching: boolean;
  /** Compact variant kept for API compatibility; both use equal flex buttons in Figma. */
  compact?: boolean;
};

const bidClass =
  "box-border h-10 min-w-0 flex-1 rounded-[4px] border border-brand-200 bg-transparent font-['DM_Sans',sans-serif] text-base font-semibold leading-6 tracking-[0.8px] text-brand-800 hover:bg-transparent dark:border-outline-variant/50 dark:text-on-surface";

/**
 * Per-lot actions: Bid + Follow (watch). OCP: `SaleroomLotCard` still accepts any `actions` slot.
 */
export function SaleroomLotActions({
  lotId,
  lotHref,
  isAuthenticated,
  initialWatching,
  compact: _c,
}: Props) {
  return (
    <div className="flex w-full min-w-0 flex-row items-stretch gap-6">
      <Button
        asChild
        variant="ghost"
        className={`min-w-0 flex-1 ${bidClass} px-6 shadow-none hover:opacity-90`}
      >
        <Link className="w-full justify-center" href={lotHref}>
          <Gavel className="mr-2.5 size-4 shrink-0" aria-hidden />
          Bid
        </Link>
      </Button>
      <div className="min-w-0 flex-1 [&>a]:flex [&>button]:flex [&>a]:w-full [&>button]:w-full">
        <ArtworkWatchToggle
          lotId={lotId}
          loginNextPath={lotHref}
          isAuthenticated={isAuthenticated}
          initialWatching={initialWatching}
          appearance="outlined-block"
        />
      </div>
    </div>
  );
}
