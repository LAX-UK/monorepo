"use client";

import type { StaffAttentionItem } from "@/lib/admin/staff-attention.types";
import {
  StaffButton,
  StaffMenu,
  StaffMenuContent,
  StaffMenuItem,
  StaffMenuLabel,
  StaffMenuSeparator,
  StaffMenuTrigger,
  StatusBadge,
} from "@auction/staff-ui";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export type { StaffAttentionItem };

const LAST_SEEN_COOKIE = "lax.staff.attention.lastSeen";

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
  const [seenAt, setSeenAt] = useState(() => readLastSeen());

  const total = items.reduce((sum, i) => sum + i.count, 0);
  const showBadge = total > 0 && seenAt === 0;

  const markSeen = () => {
    writeLastSeen();
    setSeenAt(Date.now());
  };

  return (
    <StaffMenu>
      <StaffMenuTrigger asChild>
        <StaffButton
          variant="ghost"
          size="icon-md"
          aria-label="Staff attention"
          className="relative"
        >
          <Bell aria-hidden />
          {showBadge ? (
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 size-2 rounded-full bg-staff-danger-solid ring-2 ring-staff-surface"
            />
          ) : null}
        </StaffButton>
      </StaffMenuTrigger>
      <StaffMenuContent align="end" className="w-[min(100vw-2rem,22rem)]">
        <StaffMenuLabel>Needs attention</StaffMenuLabel>
        {items.length === 0 || total === 0 ? (
          <p className="px-3 py-6 text-center text-staff-sm text-staff-muted">
            Nothing needs attention right now.
          </p>
        ) : (
          <>
            {items.map((item) => (
              <StaffMenuItem key={item.id} asChild onSelect={markSeen}>
                <Link href={item.href} className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block">{item.label}</span>
                    {item.hint ? (
                      <span className="block text-staff-xs text-staff-muted">{item.hint}</span>
                    ) : null}
                  </span>
                  <StatusBadge tone="warning">{item.count > 99 ? "99+" : item.count}</StatusBadge>
                </Link>
              </StaffMenuItem>
            ))}
            <StaffMenuSeparator />
            <StaffMenuItem onSelect={markSeen}>Mark all seen</StaffMenuItem>
          </>
        )}
      </StaffMenuContent>
    </StaffMenu>
  );
}
