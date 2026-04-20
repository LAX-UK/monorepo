"use client";

import { Button } from "@/components/ui/button";
import { useUserNotifications } from "@/hooks/use-user-notifications";
import { parseUserNotification } from "@/lib/data/http/parse";
import type { UserNotification } from "@auction/types";
import { DataTable } from "@auction/ui/components/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import { EmptyState } from "@auction/ui/components/empty-state";
import { Input } from "@auction/ui/components/input";
import { PageHeader } from "@auction/ui/components/page-header";
import { Tabs, TabsList, TabsTrigger } from "@auction/ui/components/tabs";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

type Tab = "all" | "unread" | "archived";

const PAGE = 25;

export function NotificationsInboxBoard() {
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

  const toggle = useCallback((id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

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

  const markReadOne = useCallback(async (id: string) => {
    const res = await fetch(`${apiBase()}/users/me/notifications/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
      credentials: "include",
    });
    if (res.ok) {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      toast.success("Marked as read");
    } else {
      toast.error("Could not mark as read");
    }
  }, []);

  const archiveOne = useCallback(async (id: string) => {
    const res = await fetch(`${apiBase()}/users/me/notifications/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok || res.status === 204) {
      setItems((prev) => prev.filter((n) => n.id !== id));
      setSelected((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      toast.success("Archived");
    } else {
      toast.error("Could not archive");
    }
  }, []);

  const columns = useMemo<ColumnDef<UserNotification>[]>(
    () => [
      {
        id: "select",
        header: "",
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selected.has(row.original.id)}
            onChange={() => toggle(row.original.id)}
            aria-label={`Select ${row.original.title}`}
            className="mt-1"
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
          <span
            className={`font-label text-xs font-bold uppercase tracking-widest text-primary ${
              row.original.read ? "opacity-60" : ""
            }`}
          >
            {row.original.title}
          </span>
        ),
      },
      {
        accessorKey: "message",
        header: "Message",
        cell: ({ row }) => (
          <p
            className={`max-w-md font-body text-sm text-on-surface-variant line-clamp-2 ${
              row.original.read ? "opacity-70" : ""
            }`}
          >
            {row.original.message}
          </p>
        ),
      },
      {
        id: "meta",
        header: "When",
        accessorFn: (r) => r.createdAt.getTime(),
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-body text-xs text-on-surface-variant/90">
            {row.original.type} · {new Date(row.original.createdAt).toLocaleString()}
          </span>
        ),
      },
      {
        id: "lot",
        header: "Lot",
        cell: ({ row }) =>
          row.original.lotId ? (
            <Link
              href={`/artwork/${row.original.lotId}`}
              className="font-label text-xs uppercase tracking-widest text-primary underline-offset-2 hover:underline"
            >
              View
            </Link>
          ) : (
            <span className="text-on-surface-variant">—</span>
          ),
        enableSorting: false,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const n = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-9 items-center justify-center rounded-md text-on-surface hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  aria-label="Row actions"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={n.read}
                  onSelect={() => {
                    void markReadOne(n.id);
                  }}
                >
                  Mark as read
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void archiveOne(n.id);
                  }}
                >
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
      },
    ],
    [archiveOne, markReadOne, selected, toggle],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        title="Notifications"
        description="Manage alerts for bids, wins, and saved lots. Updates in real time when you are online."
        className="border-0 pb-0"
      />

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-surface-container-high/50 p-1">
            <TabsTrigger value="all" className="font-label text-xs uppercase tracking-widest">
              All
            </TabsTrigger>
            <TabsTrigger value="unread" className="font-label text-xs uppercase tracking-widest">
              Unread
            </TabsTrigger>
            <TabsTrigger value="archived" className="font-label text-xs uppercase tracking-widest">
              Archived
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          type="search"
          placeholder="Filter by type (e.g. outbid)"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="max-w-xs bg-surface-container-lowest"
        />
      </div>

      {selected.size > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="primary" onClick={() => void markReadMany()}>
            Mark read ({selected.size})
          </Button>
          <Button type="button" variant="secondary" onClick={() => void archiveMany()}>
            Archive ({selected.size})
          </Button>
        </div>
      ) : null}

      <div className="mt-6">
        {loading ? (
          <p className="font-body text-sm text-on-surface-variant">Loading…</p>
        ) : items.length === 0 ? (
          <EmptyState
            title="No notifications"
            description="Nothing in this view yet. Try another tab or clear the type filter."
          />
        ) : (
          <DataTable columns={columns} data={items} emptyMessage="No notifications in this view." />
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
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
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
