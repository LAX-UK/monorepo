"use client";

import { useEffect, useState } from "react";
import { Toaster as SonnerToaster } from "sonner";

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

/** Global toast host — accessible defaults (duration, pause on hover). */
export function Toaster() {
  const resolvedTheme = useHtmlDarkClass();

  return (
    <SonnerToaster
      theme={resolvedTheme}
      position="top-center"
      duration={6000}
      visibleToasts={3}
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast: "font-body",
          title: "font-label text-xs uppercase tracking-widest",
          description: "font-body text-sm",
        },
      }}
    />
  );
}
