"use client";

import { Button } from "@/components/ui/button";
import { useUserNotifications } from "@/hooks/use-user-notifications";
import { parseUserNotification } from "@/lib/data/http/parse";
import { lotPath } from "@/lib/seo/url";
import type { UserNotification } from "@auction/types";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

const PAGE = 25;

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 60) return `${Math.max(1, seconds)}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return date.toLocaleDateString();
}

/**
 * Mockup-aligned minimalist notifications feed: dot + title + message + time.
 * The full inbox board is preserved at `?view=inbox` (see page).
 */
export function NotificationsFeedView() {
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = useCallback(async (offset: number, append: boolean) => {
    const params = new URLSearchParams({
      tab: "all",
      limit: String(PAGE),
      offset: String(offset),
    });
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
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await fetchPage(0, false);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

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
    }, []),
  });

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchPage(items.length, true);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title="Notifications"
        description="Latest activity in chronological order."
        className="border-0 pb-0"
        actions={
          <Button variant="secondary" asChild>
            <Link href="/dashboard/notifications?view=inbox">Switch to inbox</Link>
          </Button>
        }
      />
      <div className="mt-8">
        {loading ? (
          <p className="font-body text-sm text-on-surface-variant">Loading{"\u2026"}</p>
        ) : items.length === 0 ? (
          <EmptyState
            title="No notifications"
            description="You're all caught up. We'll let you know when something needs your attention."
          />
        ) : (
          <ul className="divide-y divide-divider-soft border-y border-divider-soft">
            {items.map((n) => (
              <li key={n.id} className="flex gap-3 py-4">
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${
                    n.read ? "bg-outline-variant/60" : "bg-primary"
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="font-headline text-sm font-semibold text-on-surface">
                    {n.lotId ? (
                      <Link
                        href={lotPath({ id: n.lotId, title: n.title })}
                        className="underline-offset-4 hover:underline"
                      >
                        {n.title}
                      </Link>
                    ) : (
                      n.title
                    )}
                  </p>
                  <p className="mt-1 text-sm text-on-surface-variant">{n.message}</p>
                </div>
                <time
                  className="shrink-0 font-label text-[11px] uppercase tracking-wider text-on-surface-variant"
                  dateTime={n.createdAt.toISOString()}
                >
                  {relativeTime(n.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
      {hasMore && !loading ? (
        <div className="mt-8 flex justify-center">
          <Button
            type="button"
            variant="secondary"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? "Loading\u2026" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
