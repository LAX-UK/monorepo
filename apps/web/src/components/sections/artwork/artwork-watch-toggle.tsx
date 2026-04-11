"use client";

import { MaterialIcon } from "@/components/ui/material-icon";
import { getBrowserHc } from "@/lib/data/http/hc-browser";
import Link from "next/link";
import { useCallback, useState } from "react";

type Props = {
  auctionId: string;
  initialWatching: boolean;
  isAuthenticated: boolean;
};

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

export function ArtworkWatchToggle({ auctionId, initialWatching, isAuthenticated }: Props) {
  const [watching, setWatching] = useState(initialWatching);
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async () => {
    if (!isAuthenticated || busy) return;
    setBusy(true);
    try {
      if (watching) {
        const res = await fetch(
          `${apiBase()}/users/me/watchlist/${encodeURIComponent(auctionId)}`,
          { method: "DELETE", credentials: "include" },
        );
        if (res.ok) setWatching(false);
      } else {
        const client = getBrowserHc();
        const res = await client.users.me.watchlist.$post({
          json: { auctionId },
        });
        if (res.ok) setWatching(true);
      }
    } finally {
      setBusy(false);
    }
  }, [auctionId, busy, isAuthenticated, watching]);

  if (!isAuthenticated) {
    return (
      <Link
        href={`/login?next=/artwork/${encodeURIComponent(auctionId)}`}
        className="inline-flex items-center gap-2 rounded-md bg-surface-container-high px-4 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container"
      >
        <MaterialIcon name="visibility" className="text-base" />
        Sign in to watch
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void toggle()}
      className={`inline-flex items-center gap-2 rounded-md px-4 py-2 font-label text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 ${
        watching
          ? "bg-primary-container/30 text-primary"
          : "bg-surface-container-high text-on-surface hover:bg-surface-container"
      }`}
    >
      <MaterialIcon name={watching ? "bookmark" : "bookmark_add"} className="text-base" />
      {watching ? "Watching" : "Watch lot"}
    </button>
  );
}
