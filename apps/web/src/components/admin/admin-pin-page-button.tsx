"use client";

import {
  isPalettePinned,
  togglePalettePinned,
} from "@/components/layout/palette/palette-cookie-client";
import { pushPaletteRecent } from "@/components/layout/palette/palette-cookie-client";
import { Button } from "@auction/ui/components/button";
import { Pin } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  label: string;
  href?: string;
};

/** Pin the current admin detail page to the staff sidebar and palette. */
export function AdminPinPageButton({ label, href }: Props) {
  const pathname = usePathname();
  const targetHref = href ?? pathname;
  const routeId = targetHref;
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    setPinned(isPalettePinned("route", routeId));
  }, [routeId]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={pinned}
      onClick={() => {
        const entry = {
          kind: "route" as const,
          id: routeId,
          href: targetHref,
          label,
        };
        const next = togglePalettePinned(entry);
        if (next) pushPaletteRecent(entry);
        setPinned(next);
      }}
    >
      <Pin className={pinned ? "size-4 fill-current" : "size-4"} aria-hidden />
      {pinned ? "Pinned" : "Pin"}
    </Button>
  );
}
