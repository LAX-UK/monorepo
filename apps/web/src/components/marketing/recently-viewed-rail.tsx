"use client";

import { FOCUS_RING, MARKETING_CATALOG_GUTTER } from "@/lib/marketing/chrome";
import { getRecentlyViewedLots } from "@/lib/marketing/recently-viewed-lots";
import { cn } from "@auction/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

/** Client-only rail of recently viewed lot links. */
export function RecentlyViewedRail({ className }: { className?: string }) {
  const [items, setItems] = useState<ReturnType<typeof getRecentlyViewedLots>>([]);

  useEffect(() => {
    setItems(getRecentlyViewedLots());
  }, []);

  if (items.length === 0) return null;

  return (
    <section
      aria-label="Recently viewed lots"
      className={cn(
        "border-b border-border-hairline bg-surface-container-low/40 py-3",
        MARKETING_CATALOG_GUTTER,
        className,
      )}
    >
      <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col gap-2">
        <h2 className="font-label text-[0.65rem] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Recently viewed
        </h2>
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {items.slice(0, 6).map((item) => (
            <li key={item.id} className="shrink-0">
              <Link
                href={item.href}
                className={cn(
                  "inline-flex max-w-[14rem] truncate rounded-full border border-outline-variant/40 bg-surface-container-lowest px-3 py-1.5 font-body text-xs text-on-surface transition-colors hover:border-link hover:text-link",
                  FOCUS_RING,
                )}
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
