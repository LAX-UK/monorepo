"use client";

import { useLotPageViewContext } from "@/components/lot-page/lot-page-view-context";
import { useShareLink } from "@/lib/lot-page/use-share-link";
import { useWatchlistToggle } from "@/lib/watchlist/use-watchlist-toggle";
import { Button, ButtonLink } from "@auction/ui/lax";
import { Check, Heart, Share2 } from "lucide-react";
import Link from "next/link";

type Props = {
  lotId: string;
  title: string;
  shareUrl: string;
  initialWatching: boolean;
  signedIn: boolean;
  lotPath: string;
};

function WatchButton({
  lotId,
  initialWatching,
  signedIn,
  lotPath,
}: Pick<Props, "lotId" | "initialWatching" | "signedIn" | "lotPath">) {
  const { watching, busy, error, announce, toggle, loginHref } = useWatchlistToggle({
    lotId,
    initialWatching,
    isAuthenticated: signedIn,
    loginNextPath: lotPath,
  });

  if (!signedIn) {
    return (
      <ButtonLink
        href={loginHref}
        Link={Link}
        variant="secondary"
        icon={<Heart aria-hidden />}
        aria-label="Sign in to watch this lot"
        className="w-full"
      >
        Watch
      </ButtonLink>
    );
  }
  return (
    <>
      <Button
        variant="secondary"
        loading={busy}
        aria-pressed={watching}
        icon={<Heart aria-hidden className={watching ? "fill-current" : undefined} />}
        onClick={() => void toggle()}
        className="w-full"
      >
        {watching ? "Watching" : "Watch"}
      </Button>
      <output className="sr-only" aria-live="polite">
        {error ?? announce ?? ""}
      </output>
    </>
  );
}

function ShareButton({ url, title }: { url: string; title: string }) {
  const { status, share } = useShareLink({ url, title });
  return (
    <>
      <Button
        variant="secondary"
        icon={status === "copied" ? <Check aria-hidden /> : <Share2 aria-hidden />}
        onClick={() => void share()}
        className="w-full"
      >
        {status === "copied" ? "Link copied" : status === "error" ? "Couldn't copy" : "Share"}
      </Button>
      <output className="sr-only" aria-live="polite">
        {status === "copied" ? "Link copied" : status === "error" ? "Couldn't copy the link" : ""}
      </output>
    </>
  );
}

/** Watch and share, side by side with full labels. Hidden where the lot is no longer in a sale. */
export function LotSecondaryActions({
  lotId,
  title,
  shareUrl,
  initialWatching,
  signedIn,
  lotPath,
}: Props) {
  const { sections } = useLotPageViewContext().view;
  if (!sections.watchShare) return null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <WatchButton
        lotId={lotId}
        initialWatching={initialWatching}
        signedIn={signedIn}
        lotPath={lotPath}
      />
      <ShareButton url={shareUrl} title={title} />
    </div>
  );
}
