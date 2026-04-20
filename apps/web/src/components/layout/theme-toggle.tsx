"use client";

import { MaterialIcon } from "@/components/ui/material-icon";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "theme";

function readDomDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(readDomDark());
  }, []);

  const toggle = useCallback(() => {
    const next = !readDomDark();
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    setIsDark(next);
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-secondary transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
    >
      <MaterialIcon name={isDark ? "light_mode" : "dark_mode"} />
    </button>
  );
}
