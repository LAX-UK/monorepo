"use client";

import { CLIENT_KIT_REVIEW_PATH } from "@/lib/kit/client-kit-review";
import { isAdminPath } from "@/lib/navigation/admin-path";
import { isClientAreaPath } from "@/lib/navigation/client-routes";
import { Toaster as AuctionToaster } from "@auction/ui";
import { Toaster as LaxToaster } from "@auction/ui/lax";
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
 * Global toast host. The client workspace uses the LAX system toast (the same element as the
 * staff tools, at the client density); public pages keep the marketing toast, whose theme
 * follows `<html class="dark">`. Admin pages render the staff toaster from their own shell
 * instead, so a toast shows once.
 */
export function Toaster() {
  const resolvedTheme = useHtmlDarkClass();
  const pathname = usePathname();
  if (isAdminPath(pathname)) return null;
  if (pathname && (isClientAreaPath(pathname) || pathname === CLIENT_KIT_REVIEW_PATH)) {
    return <LaxToaster density="client" />;
  }
  // A toast that sits at the bottom clears the docked tab bar.
  return (
    <AuctionToaster
      theme={resolvedTheme}
      mobileOffset={{ bottom: "calc(var(--lax-bottom-bar-space, 0px) + 1rem)" }}
    />
  );
}
