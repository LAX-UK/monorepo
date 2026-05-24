"use client";

import { getRecentlyViewedLots } from "@/lib/marketing/recently-viewed-lots";
import Link from "next/link";
import { useEffect, useState } from "react";

/** Client-only rail of recently viewed lot links. */
export function RecentlyViewedRail() {
  const [items, setItems] = useState<ReturnType<typeof getRecentlyViewedLots>>([]);

  useEffect(() => {
    setItems(getRecentlyViewedLots());
  }, []);

  if (items.length === 0) return null;

  return (
    <section
      aria-label="Recently viewed lots"
      className="border-b border-border-hairline bg-surface-container-low/40 px-4 py-3 md:px-8"
    >
      <div className="mx-auto flex max-w-[var(--container-max,1440px)] flex-col gap-2">
        <h2 className="font-label text-[0.65rem] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Recently viewed
        </h2>
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {items.slice(0, 6).map((item) => (
            <li key={item.id} className="shrink-0">
              <Link
                href={item.href}
                className="inline-flex max-w-[14rem] truncate rounded-full border border-outline-variant/40 bg-surface-container-lowest px-3 py-1.5 font-body text-xs text-on-surface transition-colors hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
