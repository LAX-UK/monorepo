"use client";

import { isAdminPath } from "@/lib/admin/admin-return-path";
import { Toaster as AuctionToaster } from "@auction/ui";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function useHtmlDarkClass(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setTheme(el.classList.contains("dark") ? "dark" : "light");
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

/**
 * Global toast host — theme follows `<html class="dark">`; defaults live in `@auction/ui`.
 * Admin pages render the staff toaster from their own shell instead, so a toast shows once.
 */
export function Toaster() {
  const resolvedTheme = useHtmlDarkClass();
  const pathname = usePathname();
  if (isAdminPath(pathname)) return null;
  return <AuctionToaster theme={resolvedTheme} />;
}
