"use client";

import { pushPaletteRecent } from "@/components/layout/palette/palette-cookie-client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

function labelFromPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last) return "Staff home";
  if (/^[0-9a-f-]{36}$/i.test(last) && parts.length >= 2) {
    const section = parts[parts.length - 2] ?? "Record";
    return `${section.charAt(0).toUpperCase()}${section.slice(1)} detail`;
  }
  return last.replace(/-/g, " ");
}

/** Records staff admin navigations for the command palette recents section. */
export function StaffRouteRecentTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/admin")) return;
    pushPaletteRecent({
      kind: "route",
      id: pathname,
      href: pathname,
      label: labelFromPath(pathname),
    });
  }, [pathname]);

  return null;
}
