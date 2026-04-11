"use client";

import { MaterialIcon } from "@/components/ui/material-icon";
import { getBrowserHc } from "@/lib/data/http/hc-browser";
import { parseUserNotification } from "@/lib/data/http/parse";
import type { UserNotification } from "@auction/types";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const client = getBrowserHc();
    const res = await client.users.me.notifications.$get({ query: { limit: "20" } });
    if (!res.ok) {
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

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

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

  if (!loaded || items.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        className="relative rounded-md p-1 text-secondary transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <MaterialIcon name="notifications" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 font-label text-[8px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-lg border border-outline-variant/15 bg-surface-container-lowest py-2 shadow-lg">
          <div className="max-h-80 overflow-y-auto">
            {items.map((n) => (
              <div
                key={n.id}
                className={`border-b border-outline-variant/10 px-4 py-3 last:border-0 ${
                  n.read ? "opacity-70" : ""
                }`}
              >
                <p className="font-label text-[10px] font-bold uppercase tracking-widest text-primary">
                  {n.title}
                </p>
                <p className="mt-1 font-body text-xs text-on-surface-variant">{n.message}</p>
                {n.auctionId ? (
                  <Link
                    href={`/artwork/${n.auctionId}`}
                    className="mt-2 inline-block font-label text-[9px] uppercase tracking-widest text-primary underline-offset-2 hover:underline"
                    onClick={() => void markRead(n.id)}
                  >
                    View lot
                  </Link>
                ) : !n.read ? (
                  <button
                    type="button"
                    className="mt-2 font-label text-[9px] uppercase tracking-widest text-secondary hover:text-primary"
                    onClick={() => void markRead(n.id)}
                  >
                    Mark read
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="border-t border-outline-variant/10 px-4 py-2">
            <Link
              href="/dashboard"
              className="font-label text-[9px] uppercase tracking-widest text-primary"
              onClick={() => setOpen(false)}
            >
              Open dashboard
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
