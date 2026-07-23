"use client";

import {
  PALETTE_PINNED_CHANGE_EVENT,
  readPalettePinned,
} from "@/components/layout/palette/palette-cookie-client";
import type { PalettePinnedRef } from "@/components/layout/palette/pinned-store";
import { sidebarNavItemClassName } from "@/lib/layout/sidebar-nav-classes";
import { cn } from "@auction/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  labelsHidden: boolean;
  onNavigate?: () => void;
};

/** Pinned palette entries above staff nav groups. */
export function StaffSidebarPinnedRecents({ labelsHidden, onNavigate }: Props) {
  const pathname = usePathname();
  const [pinned, setPinned] = useState<PalettePinnedRef[]>([]);

  useEffect(() => {
    void pathname;
    setPinned(readPalettePinned());
  }, [pathname]);

  useEffect(() => {
    const refresh = () => setPinned(readPalettePinned());
    window.addEventListener("focus", refresh);
    window.addEventListener(PALETTE_PINNED_CHANGE_EVENT, refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(PALETTE_PINNED_CHANGE_EVENT, refresh);
    };
  }, []);

  if (labelsHidden) return null;
  if (pinned.length === 0) return null;

  return <PinnedList pathname={pathname} pinned={pinned} {...(onNavigate ? { onNavigate } : {})} />;
}

function PinnedList({
  pathname,
  pinned,
  onNavigate,
}: {
  pathname: string;
  pinned: PalettePinnedRef[];
  onNavigate?: () => void;
}) {
  return (
    <div className="mb-1 rounded-xl border border-border-hairline bg-surface-container px-2 py-2.5 shadow-sm">
      <p className="mb-1.5 px-2 font-label text-[10px] font-medium uppercase tracking-[0.18em] text-on-surface-variant/70">
        Pinned
      </p>
      <ul className="space-y-0.5">
        {pinned.map((p) => {
          const active = pathname === p.href || pathname.startsWith(`${p.href}/`);
          return (
            <li key={`${p.kind}-${p.id}`}>
              <Link
                href={p.href}
                {...(onNavigate ? { onClick: onNavigate } : {})}
                aria-current={active ? "page" : undefined}
                className={cn(
                  sidebarNavItemClassName({ active }),
                  "min-h-9 px-2 py-1.5 text-[12px]",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{p.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
