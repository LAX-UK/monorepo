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
};

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

export function ArtworkWatchToggle({ lotId, initialWatching, isAuthenticated }: Props) {
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
