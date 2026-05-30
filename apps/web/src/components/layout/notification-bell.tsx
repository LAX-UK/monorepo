"use client";

import { ChromeIconButton } from "@/components/marketing/chrome-icon-button";
import { ChromePopoverPanel } from "@/components/marketing/chrome-popover-panel";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import { apiBaseUrl } from "@/lib/auth/api-base";
import { type SiteHeaderTone, headerChromeIconClass } from "@/lib/layout/header-chrome-tone";
import { lotPath } from "@/lib/seo/url";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

const MENU_ID = "notification-menu";

export function NotificationBell({ headerTone = "on-light" }: { headerTone?: SiteHeaderTone }) {
  const [open, setOpen] = useState(false);
  const { items, setItems, loaded, unread } = useUnreadNotifications();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEscapeKey(open, closeMenu);
  useClickOutside(open, wrapRef, closeMenu);

  const markRead = async (id: string) => {
    const res = await fetch(
      `${apiBaseUrl()}/users/me/notifications/${encodeURIComponent(id)}/read`,
      { method: "PATCH", credentials: "include" },
    );
    if (res.ok) {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    }
  };

  const markAllRead = async () => {
    const res = await fetch(`${apiBaseUrl()}/users/me/notifications/read-all`, {
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
        <Bell className={cn("animate-pulse", headerChromeIconClass(headerTone))} aria-hidden />
      </div>
    );
  }

  return (
    <div className="relative" ref={wrapRef}>
      <ChromeIconButton
        ref={triggerRef}
        label="Notifications"
        className={cn(
          "relative transition-[color,background-color] duration-300 ease-out motion-reduce:transition-none",
          headerChromeIconClass(headerTone),
        )}
        aria-expanded={open}
        aria-controls={MENU_ID}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell aria-hidden />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 font-label text-[10px] font-bold text-on-error">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </ChromeIconButton>
      {open ? (
        <ChromePopoverPanel
          id={MENU_ID}
          aria-label="Recent notifications"
          className="w-[min(100vw-2rem,22rem)] border-border-hairline bg-surface-container-lowest shadow-lg"
        >
          {unread > 0 ? (
            <div className="flex justify-end border-b border-border-hairline px-4 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-0 py-0 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:bg-transparent hover:underline"
                onClick={() => void markAllRead()}
              >
                Mark all read
              </Button>
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
                  className={`border-b border-border-hairline px-4 py-3 last:border-0 ${
                    n.read ? "opacity-70" : ""
                  }`}
                >
                  <p className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
                    {n.title}
                  </p>
                  <p className="mt-1 font-body text-xs text-on-surface-variant">{n.message}</p>
                  {n.lotId ? (
                    <Link
                      href={lotPath({ id: n.lotId, title: n.title })}
                      className="mt-2 inline-block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary underline-offset-2 hover:underline"
                      onClick={() => void markRead(n.id)}
                    >
                      View lot
                    </Link>
                  ) : !n.read ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-auto px-0 py-0 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary hover:bg-transparent hover:text-primary"
                      onClick={() => void markRead(n.id)}
                    >
                      Mark read
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-border-hairline px-4 py-2">
            <Link
              href="/dashboard/notifications"
              className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary"
              onClick={closeMenu}
            >
              View all notifications
            </Link>
            <Link
              href="/dashboard"
              className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary hover:text-primary"
              onClick={closeMenu}
            >
              Open dashboard
            </Link>
          </div>
        </ChromePopoverPanel>
      ) : null}
    </div>
  );
}
