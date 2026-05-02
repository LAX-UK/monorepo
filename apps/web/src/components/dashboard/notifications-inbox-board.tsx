"use client";

import { Button } from "@/components/ui/button";
import { useUserNotifications } from "@/hooks/use-user-notifications";
import { parseUserNotification } from "@/lib/data/http/parse";
import { notificationTypeFilterFormSchema } from "@/lib/forms/schemas/url-search";
import type { UserNotification } from "@auction/types";
import { BulkActionBar, DataTable } from "@auction/ui";
import { Button as ShadButton } from "@auction/ui/components/button";
import { Checkbox } from "@auction/ui/components/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import { EmptyState } from "@auction/ui/components/empty-state";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { PageHeader } from "@auction/ui/components/page-header";
import { Tabs, TabsList, TabsTrigger } from "@auction/ui/components/tabs";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

type Tab = "all" | "unread" | "archived";

const PAGE = 25;

export function NotificationsInboxBoard() {
  const [tab, setTab] = useState<Tab>("all");
  const typeForm = useForm({
    resolver: zodResolver(notificationTypeFilterFormSchema),
    defaultValues: { type: "" },
  });
  const typeFilter = typeForm.watch("type") ?? "";
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);

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

  useEffect(() => {
    if (loading) return;
    if (items.length === 0) {
      setFocusedId(null);
      return;
    }
    setFocusedId((prev) => {
      if (prev && items.some((x) => x.id === prev)) return prev;
      return items[0]?.id ?? null;
    });
  }, [items, loading]);

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
          <Checkbox
            checked={selected.has(row.original.id)}
            onCheckedChange={() => toggle(row.original.id)}
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
          <span className="flex min-w-[180px] items-center gap-2">
            <span
              className={`size-2 rounded-full ${
                row.original.read ? "bg-outline-variant/60" : "bg-primary"
              }`}
              aria-hidden
            />
            <span
              className={`font-label text-xs font-bold uppercase tracking-widest text-primary ${
                row.original.read ? "opacity-60" : ""
              }`}
            >
              {row.original.title}
            </span>
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
                <ShadButton
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-md text-on-surface hover:bg-surface-container-high"
                  aria-label="Row actions"
                >
                  <MoreHorizontal className="size-4" />
                </ShadButton>
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

  const focused = useMemo(
    () => (focusedId ? (items.find((n) => n.id === focusedId) ?? null) : null),
    [focusedId, items],
  );

  return (
    <div className={`mx-auto max-w-5xl px-4 py-10 ${selected.size > 0 ? "pb-28 md:pb-10" : ""}`}>
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
        <Form {...typeForm}>
          <form className="max-w-xs" onSubmit={(e) => e.preventDefault()}>
            <FormField
              control={typeForm.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Filter by type</FormLabel>
                  <FormControl>
                    <Input
                      type="search"
                      placeholder="Filter by type (e.g. outbid)"
                      className="min-h-11 bg-surface-container-lowest text-base md:text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>

      <div className="-mx-1 mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {(
          [
            { key: "", label: "All types" },
            { key: "outbid", label: "Outbid" },
            { key: "lot_won", label: "Won" },
            { key: "lot_lost", label: "Lost" },
            { key: "payment_due", label: "Payment" },
          ] as const
        ).map((chip) => (
          <ShadButton
            key={chip.label}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => typeForm.setValue("type", chip.key)}
            className={`h-auto shrink-0 snap-start rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ring-1 ${
              typeFilter === chip.key
                ? "bg-primary text-on-primary ring-primary hover:bg-primary hover:text-on-primary"
                : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
            }`}
          >
            {chip.label}
          </ShadButton>
        ))}
      </div>

      <div className="mt-4">
        <BulkActionBar count={selected.size}>
          <Button
            type="button"
            variant="primary"
            className="min-h-11"
            onClick={() => void markReadMany()}
          >
            Mark read
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => void archiveMany()}
          >
            Archive
          </Button>
        </BulkActionBar>
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="font-body text-sm text-on-surface-variant">Loading…</p>
        ) : items.length === 0 ? (
          <EmptyState
            title="No notifications"
            description="Nothing in this view yet. Try another tab or clear the type filter."
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
                <nav
                  aria-label="Notification threads"
                  className="max-h-[70vh] overflow-y-auto rounded-sm border border-outline-variant/15 bg-surface-container-lowest/60"
                >
                  {items.map((n) => {
                    const isActive = n.id === focusedId;
                    return (
                      <div
                        key={n.id}
                        className={`flex gap-3 border-b border-outline-variant/10 p-3 transition-colors last:border-b-0 ${
                          isActive
                            ? "bg-surface-container-high/80"
                            : n.read
                              ? "bg-transparent"
                              : "bg-primary-container/10"
                        }`}
                      >
                        <Checkbox
                          checked={selected.has(n.id)}
                          onCheckedChange={() => toggle(n.id)}
                          aria-label={`Select ${n.title}`}
                          className="mt-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <ShadButton
                          type="button"
                          variant="ghost"
                          onClick={() => setFocusedId(n.id)}
                          className="h-auto min-w-0 flex-1 flex-col items-start justify-start rounded-md px-2 py-2 text-left hover:bg-surface-container-high/40"
                        >
                          <span className="flex w-full items-center justify-between gap-3">
                            <span className="flex min-w-0 items-center gap-2">
                              <span
                                className={`size-2 rounded-full ${
                                  n.read ? "bg-outline-variant/60" : "bg-primary"
                                }`}
                                aria-hidden
                              />
                              <span
                                className={`truncate font-label text-xs font-bold uppercase tracking-widest text-primary ${
                                  n.read ? "opacity-60" : ""
                                }`}
                              >
                                {n.title}
                              </span>
                            </span>
                            <span className="shrink-0 font-body text-[11px] text-on-surface-variant/90">
                              {new Date(n.createdAt).toLocaleString()}
                            </span>
                          </span>
                          <p
                            className={`mt-1 line-clamp-2 font-body text-sm text-on-surface-variant ${
                              n.read ? "opacity-70" : ""
                            }`}
                          >
                            {n.message}
                          </p>
                          <p className="mt-2 font-body text-xs text-on-surface-variant/90">
                            {n.type}
                          </p>
                        </ShadButton>
                      </div>
                    );
                  })}
                </nav>
                <article
                  aria-live="polite"
                  className="min-h-[280px] rounded-sm border border-outline-variant/15 bg-surface-container-lowest/40 p-6"
                >
                  {focused ? (
                    <div className="space-y-4">
                      <div>
                        <p className="font-label text-xs font-bold uppercase tracking-widest text-primary">
                          {focused.title}
                        </p>
                        <p className="mt-2 font-body text-sm text-on-surface">{focused.message}</p>
                        <p className="mt-3 font-body text-xs text-on-surface-variant">
                          {focused.type} · {new Date(focused.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="primary"
                          disabled={focused.read}
                          onClick={() => void markReadOne(focused.id)}
                        >
                          Mark as read
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void archiveOne(focused.id)}
                        >
                          Archive
                        </Button>
                        {focused.lotId ? (
                          <Button type="button" variant="secondary" asChild>
                            <Link href={`/artwork/${focused.lotId}`}>View lot</Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="font-body text-sm text-on-surface-variant">
                      Select a notification.
                    </p>
                  )}
                </article>
              </div>
            </div>
            <div className="lg:hidden">
              <DataTable
                columns={columns}
                data={items}
                emptyMessage="No notifications in this view."
              />
            </div>
          </>
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
