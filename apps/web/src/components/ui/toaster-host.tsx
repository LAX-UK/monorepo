"use client";

import { CLIENT_KIT_REVIEW_PATH } from "@/lib/kit/client-kit-review";
import { isAdminPath } from "@/lib/navigation/admin-path";
import { isClientAreaPath } from "@/lib/navigation/client-routes";
import { registerToaster } from "@/lib/ui/toast-bridge";
import { Toaster as AuctionToaster } from "@auction/ui/components/sonner";
import { Toaster as LaxToaster } from "@auction/ui/lax/toaster";
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

/** Tells the toast bridge a toaster is on screen, so toasts raised earlier can appear. */
function usePresenceOnScreen(onScreen: boolean): void {
  useEffect(() => (onScreen ? registerToaster() : undefined), [onScreen]);
}

/**
 * Global toast host, fetched when the first toast is raised (see `Toaster`). The client workspace uses the LAX system toast (the same element as the
 * staff tools, at the client density); public pages keep the marketing toast, whose theme
 * follows `<html class="dark">`. Admin pages render the staff toaster from their own shell
 * instead, so a toast shows once.
 */
export function ToasterHost() {
  const resolvedTheme = useHtmlDarkClass();
  const pathname = usePathname();
  const hidden = isAdminPath(pathname);
  usePresenceOnScreen(!hidden);
  if (hidden) return null;
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
