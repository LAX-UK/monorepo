"use client";

import { getBrowserHc } from "@/lib/data/http/hc-browser";
import { Button } from "@auction/ui/components/button";
import { Bookmark, BookmarkPlus, Eye } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

type Props = {
  lotId: string;
  initialWatching: boolean;
  isAuthenticated: boolean;
  /**
   * `outlined-block` — saleroom lot card: 40px, light border #A3A3A3, 4px radius.
   * `default` — existing card / detail rail (unchanged for LSP).
   */
  appearance?: "default" | "outlined-block";
};

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

const lotBtnClass =
  "box-border inline-flex h-10 min-w-0 flex-1 items-center justify-center rounded-[4px] border border-brand-200 bg-transparent px-8 font-['DM_Sans',sans-serif] text-base font-semibold leading-6 tracking-[0.8px] text-brand-800 hover:bg-transparent hover:opacity-90 dark:border-outline-variant/50 dark:text-on-surface";

export function ArtworkWatchToggle({
  lotId,
  initialWatching,
  isAuthenticated,
  appearance = "default",
}: Props) {
  const [watching, setWatching] = useState(initialWatching);
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async () => {
    if (!isAuthenticated || busy) return;
    setBusy(true);
    try {
      if (watching) {
        const res = await fetch(`${apiBase()}/users/me/watchlist/${encodeURIComponent(lotId)}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (res.ok) setWatching(false);
      } else {
        const client = getBrowserHc();
        const res = await client.users.me.watchlist.$post({
          json: { lotId },
        });
        if (res.ok) setWatching(true);
      }
    } finally {
      setBusy(false);
    }
  }, [lotId, busy, isAuthenticated, watching]);

  if (!isAuthenticated) {
    if (appearance === "outlined-block") {
      return (
        <Link
          href={`/login?next=/artwork/${encodeURIComponent(lotId)}`}
          className={`${lotBtnClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 dark:focus-visible:outline-on-surface`}
        >
          Follow
        </Link>
      );
    }
    return (
      <Link
        href={`/login?next=/artwork/${encodeURIComponent(lotId)}`}
        className="inline-flex items-center gap-2 rounded-md bg-surface-container-high px-4 py-2 font-label text-xs font-bold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container"
      >
        <Eye className="size-4" aria-hidden />
        Sign in to watch
      </Link>
    );
  }

  if (appearance === "outlined-block") {
    return (
      <Button
        type="button"
        variant="ghost"
        disabled={busy}
        aria-pressed={watching}
        onClick={() => void toggle()}
        className={`${lotBtnClass} ${watching ? "border-primary/40 bg-primary/5" : ""}`}
      >
        {watching ? "Following" : "Follow"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={busy}
      aria-pressed={watching}
      onClick={() => void toggle()}
      className={`h-auto gap-2 rounded-md px-4 py-2 font-label text-xs font-bold uppercase tracking-widest ${
        watching
          ? "bg-primary-container/30 text-primary hover:bg-primary-container/30"
          : "bg-surface-container-high text-on-surface hover:bg-surface-container"
      }`}
    >
      {watching ? (
        <Bookmark className="size-4" aria-hidden />
      ) : (
        <BookmarkPlus className="size-4" aria-hidden />
      )}
      {watching ? "Watching" : "Watch lot"}
    </Button>
  );
}
