"use client";

import { Button } from "@auction/ui/components/button";
import { Moon, Sun } from "lucide-react";
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
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="min-h-[44px] min-w-[44px] text-secondary hover:bg-surface-container-low hover:text-primary"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
    >
      {isDark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}
