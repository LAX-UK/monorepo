"use client";

import { readPalettePinned } from "@/components/layout/palette/palette-cookie-client";
import type { PalettePinnedRef } from "@/components/layout/palette/pinned-store";
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
    return () => window.removeEventListener("focus", refresh);
  }, []);

  if (labelsHidden) return null;
  if (pinned.length === 0) return null;

  return (
    <PinnedList pathname={pathname} pinned={pinned} {...(onNavigate ? { onNavigate } : {})} />
  );
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
    <div className="border-b border-border-hairline px-1 pb-3 pt-1">
      <p className="mb-1 px-3 font-label text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
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
                  "block truncate rounded-md px-3 py-1.5 font-label text-[12px] text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface",
                  active && "bg-primary-container/40 text-on-primary-container",
                )}
              >
                {p.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
