"use client";

import { Toaster as AuctionToaster } from "@auction/ui";
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

/** Global toast host — theme follows `<html class="dark">`; defaults live in `@auction/ui`. */
export function Toaster() {
  const resolvedTheme = useHtmlDarkClass();
  return <AuctionToaster theme={resolvedTheme} />;
}
