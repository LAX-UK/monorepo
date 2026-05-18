"use client";

import { getBrowserHc } from "@/lib/data/http/hc-browser";
import { useCallback, useEffect, useState } from "react";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

export type UseWatchlistToggleArgs = {
  lotId: string;
  initialWatching: boolean;
  isAuthenticated: boolean;
  loginNextPath: string;
};

export type UseWatchlistToggleResult = {
  watching: boolean;
  busy: boolean;
  error: string | null;
  /** Polite live-region copy after a successful toggle (cleared on next interaction). */
  announce: string | null;
  toggle: () => Promise<void>;
  loginHref: string;
};

/**
 * Client-side watchlist add/remove with optimistic UI and rollback on failure.
 * Matches the behaviour previously inlined in `ArtworkWatchToggle`.
 */
export function useWatchlistToggle({
  lotId,
  initialWatching,
  isAuthenticated,
  loginNextPath,
}: UseWatchlistToggleArgs): UseWatchlistToggleResult {
  const [watching, setWatching] = useState(initialWatching);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState<string | null>(null);

  useEffect(() => {
    setWatching(initialWatching);
  }, [initialWatching]);

  const loginHref = `/login?next=${encodeURIComponent(loginNextPath)}`;

  const toggle = useCallback(async () => {
    if (!isAuthenticated || busy) return;
    setError(null);
    setAnnounce(null);
    const prev = watching;
    setBusy(true);
    setWatching(!prev);
    try {
      if (prev) {
        const res = await fetch(`${apiBase()}/users/me/watchlist/${encodeURIComponent(lotId)}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) throw new Error("remove_failed");
        setAnnounce("Removed from watchlist");
      } else {
        const client = getBrowserHc();
        const res = await client.users.me.watchlist.$post({
          json: { lotId },
        });
        if (!res.ok) throw new Error("add_failed");
        const { trackAddToWishlist } = await import("@/lib/analytics/events");
        trackAddToWishlist(lotId);
        setAnnounce("Added to watchlist");
      }
    } catch {
      setWatching(prev);
      setError("Couldn't update watchlist");
    } finally {
      setBusy(false);
    }
  }, [lotId, busy, isAuthenticated, watching]);

  return { watching, busy, error, announce, toggle, loginHref };
}
