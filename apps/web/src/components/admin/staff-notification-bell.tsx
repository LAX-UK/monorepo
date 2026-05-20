"use client";

import { ChromeIconButton } from "@/components/marketing/chrome-icon-button";
import { ChromePopoverPanel } from "@/components/marketing/chrome-popover-panel";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

const MENU_ID = "staff-attention-menu";
const LAST_SEEN_COOKIE = "lax.staff.attention.lastSeen";

export type StaffAttentionItem = {
  id: string;
  href: string;
  label: string;
  count: number;
  hint?: string;
};

type Props = {
  items: StaffAttentionItem[];
};

function readLastSeen(): number {
  if (typeof document === "undefined") return 0;
  const match = document.cookie.match(new RegExp(`${LAST_SEEN_COOKIE}=([^;]+)`));
  if (!match?.[1]) return 0;
  const n = Number.parseInt(match[1], 10);
  return Number.isNaN(n) ? 0 : n;
}

function writeLastSeen(): void {
  if (typeof document === "undefined") return;
  const ts = String(Date.now());
  document.cookie = `${LAST_SEEN_COOKIE}=${ts}; path=/admin; max-age=31536000; SameSite=Lax`;
}

/** Staff header attention feed (submissions, artists, manual review). */
export function StaffNotificationBell({ items }: Props) {
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(() => readLastSeen());
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const total = items.reduce((sum, i) => sum + i.count, 0);
  const showBadge = total > 0 && seenAt === 0;

  const closeMenu = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEscapeKey(open, closeMenu);
  useClickOutside(open, wrapRef, closeMenu);

  const markSeen = () => {
    writeLastSeen();
    setSeenAt(Date.now());
    closeMenu();
  };

  return (
    <div className="relative" ref={wrapRef}>
      <ChromeIconButton
        ref={triggerRef}
        label="Staff attention"
        className={cn(
          "relative text-secondary transition-[color,background-color] duration-300 ease-out motion-reduce:transition-none hover:bg-surface-container-low hover:text-primary",
        )}
        aria-expanded={open}
        aria-controls={MENU_ID}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell aria-hidden />
        {showBadge ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 font-label text-[10px] font-bold text-on-error">
            {total > 9 ? "9+" : total}
          </span>
        ) : null}
      </ChromeIconButton>
      {open ? (
        <ChromePopoverPanel
          id={MENU_ID}
          aria-label="Items needing attention"
          className="w-[min(100vw-2rem,22rem)] border-border-hairline bg-surface-container-lowest shadow-lg"
        >
          {total > 0 ? (
            <div className="flex justify-end border-b border-border-hairline px-4 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-0 py-0 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:bg-transparent hover:underline"
                onClick={markSeen}
              >
                Mark seen
              </Button>
            </div>
          ) : null}
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 || total === 0 ? (
              <p className="px-4 py-6 text-center font-body text-sm text-on-surface-variant">
                Nothing needs attention right now.
              </p>
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center justify-between gap-2 border-b border-border-hairline px-4 py-3 last:border-0 hover:bg-surface-container-low"
                  onClick={markSeen}
                >
                  <div className="min-w-0">
                    <p className="font-body text-sm text-on-surface">{item.label}</p>
                    {item.hint ? (
                      <p className="font-body text-xs text-on-surface-variant">{item.hint}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-lot-orange px-2 py-0.5 font-label text-[10px] font-bold text-white">
                    {item.count > 99 ? "99+" : item.count}
                  </span>
                </Link>
              ))
            )}
          </div>
        </ChromePopoverPanel>
      ) : null}
    </div>
  );
}
