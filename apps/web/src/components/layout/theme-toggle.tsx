"use client";

import { useSiteHeaderChrome } from "@/components/layout/site-header-chrome-context";
import { syncUiThemeFromClientAction } from "@/lib/actions/user-ui-preferences";
import { applyThemeDom } from "@/lib/preferences/apply-theme-dom";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

function readDomDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** uses the View Transitions API to perform a circular reveal from the
 * toggle's center when the theme switches. Falls back to instant toggle in
 * browsers without support, or when reduced-motion is preferred.
 */
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { blendWithHero } = useSiteHeaderChrome();

  useEffect(() => {
    setIsDark(readDomDark());
    const root = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(readDomDark()));
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const toggle = useCallback(() => {
    const next = !readDomDark();
    const mode = next ? "dark" : "light";
    const apply = () => {
      applyThemeDom(mode);
      setIsDark(next);
      void syncUiThemeFromClientAction({ theme: mode });
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const supportsViewTransitions =
      typeof document !== "undefined" &&
      typeof (document as Document & { startViewTransition?: unknown }).startViewTransition ===
        "function";

    if (reduced || !supportsViewTransitions) {
      apply();
      return;
    }

    const btn = buttonRef.current;
    const rect = btn?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth - 32;
    const cy = rect ? rect.top + rect.height / 2 : 32;
    const radius = Math.hypot(
      Math.max(cx, window.innerWidth - cx),
      Math.max(cy, window.innerHeight - cy),
    );

    document.documentElement.style.setProperty("--theme-toggle-x", `${cx}px`);
    document.documentElement.style.setProperty("--theme-toggle-y", `${cy}px`);
    document.documentElement.style.setProperty("--theme-toggle-radius", `${radius}px`);

    const transition = (
      document as Document & {
        startViewTransition: (cb: () => void) => { finished: Promise<void> };
      }
    ).startViewTransition(() => {
      apply();
    });

    transition.finished.finally(() => {
      document.documentElement.style.removeProperty("--theme-toggle-x");
      document.documentElement.style.removeProperty("--theme-toggle-y");
      document.documentElement.style.removeProperty("--theme-toggle-radius");
    });
  }, []);

  return (
    <Button
      ref={buttonRef}
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      className={cn(
        "min-h-[44px] min-w-[44px] transition-[color,background-color] duration-300 ease-out motion-reduce:transition-none",
        blendWithHero
          ? "text-white hover:bg-white/10 hover:text-white dark:text-on-surface-variant dark:hover:bg-surface-container-low dark:hover:text-on-surface"
          : "text-secondary hover:bg-surface-container-low hover:text-primary",
      )}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
    >
      {isDark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}
