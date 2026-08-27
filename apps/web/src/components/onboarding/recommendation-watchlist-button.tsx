"use client";

import { useWatchlistToggle } from "@/lib/watchlist/use-watchlist-toggle";
import { Button } from "@auction/ui/components/button";
import { Heart, Loader2 } from "lucide-react";

type Props = {
  lotId: string;
  lotTitle: string;
  initialWatching: boolean;
  loginNextPath: string;
};

export function RecommendationWatchlistButton({
  lotId,
  lotTitle,
  initialWatching,
  loginNextPath,
}: Props) {
  const { watching, busy, error, announce, toggle } = useWatchlistToggle({
    lotId,
    initialWatching,
    isAuthenticated: true,
    loginNextPath,
  });
  return (
    <>
      <Button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        aria-pressed={watching}
        aria-label={`${watching ? "Remove" : "Add"} ${lotTitle} ${watching ? "from" : "to"} watchlist`}
        className="flex h-12 w-full items-center justify-center gap-[11px] rounded border border-outline-variant/40 bg-surface-container-lowest text-base font-medium text-on-surface shadow-none transition-colors hover:border-primary/40 hover:bg-primary/[0.04] disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <Heart
            className={`size-5 ${watching ? "fill-secondary text-secondary" : ""}`}
            aria-hidden
          />
        )}
        {busy ? "Updating…" : watching ? "Added to watchlist" : "Add to watchlist"}
      </Button>
      <output className="sr-only" aria-live="polite">
        {error ?? announce ?? ""}
      </output>
    </>
  );
}
