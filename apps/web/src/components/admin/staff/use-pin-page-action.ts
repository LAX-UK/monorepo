"use client";

import {
  isPalettePinned,
  pushPaletteRecent,
  togglePalettePinned,
} from "@/components/layout/palette/palette-cookie-client";
import type { OverflowAction } from "@auction/staff-ui";
import { Pin } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The "Pin to sidebar" entry of a record page's overflow menu: pins this page to the sidebar and
 * the command palette, or unpins it, under the record's name.
 */
export function usePinPageAction(label: string): OverflowAction {
  const pathname = usePathname() ?? "";
  const [pinned, setPinned] = useState(false);
  useEffect(() => setPinned(isPalettePinned("route", pathname)), [pathname]);
  return {
    id: "pin",
    label: pinned ? "Unpin from sidebar" : "Pin to sidebar",
    icon: Pin,
    onSelect: () => {
      const entry = { kind: "route" as const, id: pathname, href: pathname, label };
      const next = togglePalettePinned(entry);
      if (next) pushPaletteRecent(entry);
      setPinned(next);
    },
  };
}
