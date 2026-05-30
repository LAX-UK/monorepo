"use client";

import { ChromeIconButton } from "@/components/marketing/chrome-icon-button";
import { syncUiThemeFromClientAction } from "@/lib/actions/user-ui-preferences";
import { type SiteHeaderTone, headerChromeIconClass } from "@/lib/layout/header-chrome-tone";
import { applyThemeDom } from "@/lib/preferences/apply-theme-dom";
import { cn } from "@auction/ui";
import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

function readDomDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** uses the View Transitions API to perform a circular reveal from the
 * toggle's center when the theme switches. Falls back to instant toggle in
 * browsers without support, or when reduced-motion is preferred.
 */
export function ThemeToggle({ headerTone = "on-light" }: { headerTone?: SiteHeaderTone }) {
  const [isDark, setIsDark] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

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

    const cleanup = () => {
      document.documentElement.style.removeProperty("--theme-toggle-x");
      document.documentElement.style.removeProperty("--theme-toggle-y");
      document.documentElement.style.removeProperty("--theme-toggle-radius");
    };

    try {
      const transition = (
        document as Document & {
          startViewTransition: (cb: () => void) => { finished: Promise<void> };
        }
      ).startViewTransition(() => {
        apply();
      });
      void transition.finished.finally(cleanup).catch(() => {
        /* Duplicate view-transition-name or aborted transition — theme already applied */
      });
    } catch {
      apply();
      cleanup();
    }
  }, []);

  return (
    <ChromeIconButton
      ref={buttonRef}
      label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggle}
      aria-pressed={isDark}
      className={cn(
        "transition-[color,background-color] duration-300 ease-out motion-reduce:transition-none",
        headerChromeIconClass(headerTone),
      )}
    >
      {isDark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </ChromeIconButton>
  );
}
