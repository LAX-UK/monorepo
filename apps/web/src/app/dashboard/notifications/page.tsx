"use client";

import { useUserNotifications } from "@/hooks/use-user-notifications";
import { parseUserNotification } from "@/lib/data/http/parse";
import type { UserNotification } from "@auction/types";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

type Tab = "all" | "unread" | "archived";

const PAGE = 25;

export default function NotificationsPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchNotifications = useCallback(
    async (offset: number, append: boolean) => {
      const params = new URLSearchParams({
        tab,
        limit: String(PAGE),
        offset: String(offset),
      });
      if (typeFilter.trim()) params.set("type", typeFilter.trim());
      const res = await fetch(`${apiBase()}/users/me/notifications?${params}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (!append) setItems([]);
        setHasMore(false);
        return;
      }
      const body = (await res.json()) as { data: unknown[] };
      const page = body.data.map(parseUserNotification);
      setItems((prev) => (append ? [...prev, ...page] : page));
      setHasMore(page.length === PAGE);
    },
    [tab, typeFilter],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelected(new Set());
    void (async () => {
      await fetchNotifications(0, false);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchNotifications]);

  useUserNotifications({
    enabled: !loading,
    onNotification: useCallback((n: UserNotification) => {
      setItems((prev) => {
        const idx = prev.findIndex((x) => x.id === n.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = n;
          return next;
        }
        return [n, ...prev];
      });
      toast.info(n.title, { description: n.message, id: `inbox-${n.id}` });
    }, []),
  });

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchNotifications(items.length, true);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const markReadMany = async () => {
    if (selected.size === 0) return;
    const res = await fetch(`${apiBase()}/users/me/notifications/read-bulk`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected] }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((n) => (selected.has(n.id) ? { ...n, read: true } : n)));
      setSelected(new Set());
      toast.success("Marked as read");
    }
  };

  const archiveMany = async () => {
    if (selected.size === 0) return;
    for (const id of selected) {
      await fetch(`${apiBase()}/users/me/notifications/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
    }
    setItems((prev) => prev.filter((n) => !selected.has(n.id)));
    setSelected(new Set());
    toast.success("Archived selected");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-headline text-2xl text-on-surface">Notifications</h1>
      <p className="mt-2 font-body text-sm text-on-surface-variant">
        Manage alerts for bids, wins, and saved lots. Updates in real time when you&apos;re online.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-2 border-b border-outline-variant/15 pb-4">
        {(["all", "unread", "archived"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ${
              tab === t
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-secondary hover:text-primary"
            }`}
          >
            {t === "all" ? "All" : t === "unread" ? "Unread" : "Archived"}
          </button>
        ))}
        <input
          type="search"
          placeholder="Filter by type (e.g. outbid)"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="ml-auto min-w-[12rem] rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 font-body text-sm"
        />
      </div>

      {selected.size > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void markReadMany()}
            className="rounded-md bg-primary px-4 py-2 font-label text-xs uppercase tracking-widest text-on-primary"
          >
            Mark read ({selected.size})
          </button>
          <button
            type="button"
            onClick={() => void archiveMany()}
            className="rounded-md border border-outline-variant/40 px-4 py-2 font-label text-xs uppercase tracking-widest text-primary"
          >
            Archive ({selected.size})
          </button>
        </div>
      ) : null}

      <ul className="mt-6 space-y-3">
        {loading ? (
          <li className="font-body text-sm text-on-surface-variant">Loading…</li>
        ) : items.length === 0 ? (
          <li className="font-body text-sm text-on-surface-variant">
            No notifications in this view.
          </li>
        ) : (
          items.map((n) => (
            <li
              key={n.id}
              className={`flex gap-3 rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-4 ${
                n.read ? "opacity-70" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(n.id)}
                onChange={() => toggle(n.id)}
                aria-label={`Select ${n.title}`}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <p className="font-label text-xs font-bold uppercase tracking-widest text-primary">
                  {n.title}
                </p>
                <p className="mt-1 font-body text-sm text-on-surface-variant">{n.message}</p>
                <p className="mt-2 font-body text-xs text-on-surface-variant/80">
                  {n.type} · {new Date(n.createdAt).toLocaleString()}
                </p>
                {n.lotId ? (
                  <Link
                    href={`/artwork/${n.lotId}`}
                    className="mt-2 inline-block font-label text-xs uppercase tracking-widest text-primary underline-offset-2 hover:underline"
                  >
                    View lot
                  </Link>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>

      {hasMore && !loading ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            className="rounded-md border border-primary/40 px-6 py-3 font-label text-xs uppercase tracking-widest text-primary disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}

      <p className="mt-10 font-body text-sm text-on-surface-variant">
        Tip: enable browser push in{" "}
        <Link
          href="/dashboard/settings/notifications"
          className="text-primary underline-offset-2 hover:underline"
        >
          alert settings
        </Link>
        .
      </p>
    </div>
  );
}
