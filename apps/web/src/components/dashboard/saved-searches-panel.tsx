"use client";

import { DashboardErrorAlert } from "@/components/dashboard/primitives/dashboard-error-alert";
import {
  type SavedSearchRow,
  deleteSavedSearch,
  fetchSavedSearches,
} from "@/lib/data/http/saved-searches.client";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function buildSearchHref(query: Record<string, string>): string {
  const params = new URLSearchParams(query);
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

/** Lists and deletes saved catalogue searches for the signed-in user. */
export function SavedSearchesPanel() {
  const [rows, setRows] = useState<SavedSearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchSavedSearches();
      if (!result.ok) {
        setRows([]);
        setLoadError(result.error);
        return;
      }
      setRows(result.rows);
    } catch {
      setRows([]);
      setLoadError("Could not load saved searches. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    setRemovingId(id);
    try {
      const ok = await deleteSavedSearch(id);
      if (!ok) {
        notify.error("Could not remove saved search");
        return;
      }
      setRows((prev) => prev.filter((row) => row.id !== id));
      notify.success("Saved search removed");
    } catch {
      notify.error("Could not remove saved search");
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) {
    return <p className="font-body text-sm text-on-surface-variant">Loading saved searches…</p>;
  }

  if (loadError) {
    return (
      <DashboardErrorAlert title="Saved searches unavailable" message={loadError}>
        <Button type="button" variant="secondaryOutline" size="sm" onClick={() => void load()}>
          Retry
        </Button>
      </DashboardErrorAlert>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="font-body text-sm text-on-surface-variant">
        No saved searches yet. Use{" "}
        <Link href="/search" className="font-medium text-link underline">
          catalogue search
        </Link>{" "}
        and tap &ldquo;Save this search&rdquo; when signed in.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border-hairline">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 space-y-1">
            <Link
              href={buildSearchHref(row.query)}
              className="font-body text-sm font-medium text-on-surface hover:text-link hover:underline"
            >
              {row.label}
            </Link>
            <p className="font-body text-xs text-on-surface-variant">
              {row.notifyEmail ? "Email alerts on" : "Email alerts off"}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-10 shrink-0"
            disabled={removingId === row.id}
            onClick={() => void remove(row.id)}
          >
            {removingId === row.id ? "Removing…" : "Remove"}
          </Button>
        </li>
      ))}
    </ul>
  );
}
