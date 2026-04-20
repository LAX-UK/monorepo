"use client";

import { MaterialIcon } from "@/components/ui/material-icon";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useUserNotifications } from "@/hooks/use-user-notifications";
import { getBrowserHc } from "@/lib/data/http/hc-browser";
import { parseUserNotification } from "@/lib/data/http/parse";
import type { UserNotification } from "@auction/types";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const MENU_ID = "notification-menu";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(async () => {
    const client = getBrowserHc();
    const res = await client.users.me.notifications.$get({ query: { limit: "20" } });
    if (!res.ok) {
      setItems([]);
      setLoaded(true);
      return;
    }
    const body = (await res.json()) as { data: unknown[] };
    setItems(body.data.map(parseUserNotification));
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onRealtimeNotification = useCallback((n: UserNotification) => {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === n.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = n;
        return next;
      }
      return [n, ...prev].slice(0, 50);
    });
    toast.info(n.title, {
      id: `inbox-${n.id}`,
      description: n.message,
      duration: 6000,
    });
  }, []);

  useUserNotifications({
    enabled: loaded,
    onNotification: onRealtimeNotification,
  });

  const closeMenu = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEscapeKey(open, closeMenu);
  useClickOutside(open, wrapRef, closeMenu);

  const unread = items.filter((n) => !n.read).length;

  const markRead = async (id: string) => {
    const res = await fetch(`${apiBase()}/users/me/notifications/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
      credentials: "include",
    });
    if (res.ok) {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    }
  };

  const markAllRead = async () => {
    const res = await fetch(`${apiBase()}/users/me/notifications/read-all`, {
      method: "PATCH",
      credentials: "include",
    });
    if (res.ok) {
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  if (!loaded) {
    return (
      <div
        className="flex h-10 w-10 items-center justify-center"
        aria-busy="true"
        aria-label="Loading notifications"
      >
        <MaterialIcon name="notifications" className="animate-pulse text-secondary" />
      </div>
    );
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-secondary transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label="Notifications"
        aria-expanded={open}
        aria-controls={MENU_ID}
        onClick={() => setOpen((o) => !o)}
      >
        <MaterialIcon name="notifications" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 font-label text-[10px] font-bold text-on-error">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <section
          id={MENU_ID}
          aria-label="Recent notifications"
          className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-lg border border-outline-variant/15 bg-surface-container-lowest py-2 shadow-lg"
        >
          {unread > 0 ? (
            <div className="flex justify-end border-b border-outline-variant/10 px-4 py-2">
              <button
                type="button"
                className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
                onClick={() => void markAllRead()}
              >
                Mark all read
              </button>
            </div>
          ) : null}
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center font-body text-sm text-on-surface-variant">
                No notifications yet.
              </p>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-outline-variant/10 px-4 py-3 last:border-0 ${
                    n.read ? "opacity-70" : ""
                  }`}
                >
                  <p className="font-label text-xs font-bold uppercase tracking-widest text-primary">
                    {n.title}
                  </p>
                  <p className="mt-1 font-body text-xs text-on-surface-variant">{n.message}</p>
                  {n.lotId ? (
                    <Link
                      href={`/artwork/${n.lotId}`}
                      className="mt-2 inline-block font-label text-xs uppercase tracking-widest text-primary underline-offset-2 hover:underline"
                      onClick={() => void markRead(n.id)}
                    >
                      View lot
                    </Link>
                  ) : !n.read ? (
                    <button
                      type="button"
                      className="mt-2 font-label text-xs uppercase tracking-widest text-secondary hover:text-primary"
                      onClick={() => void markRead(n.id)}
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-outline-variant/10 px-4 py-2">
            <Link
              href="/dashboard/notifications"
              className="font-label text-xs uppercase tracking-widest text-primary"
              onClick={closeMenu}
            >
              View all notifications
            </Link>
            <Link
              href="/dashboard"
              className="font-label text-xs uppercase tracking-widest text-secondary hover:text-primary"
              onClick={closeMenu}
            >
              Open dashboard
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
