"use client";

import { ShellChromeIconButton } from "@/components/layout/shell-chrome-icon-button";
import { ChromeIconButton } from "@/components/marketing/chrome-icon-button";
import { syncUiThemeFromClientAction } from "@/lib/actions/user-ui-preferences";
import type { ChromeSurface } from "@/lib/layout/chrome-surface";
import { type SiteHeaderTone, headerChromeIconClass } from "@/lib/layout/header-chrome-tone";
import { applyThemeDom } from "@/lib/preferences/apply-theme-dom";
import { canPlayViewTransition, withViewTransition } from "@/lib/view-transition-runtime";
import { cn } from "@auction/ui/lib/utils";
import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

function readDomDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

type ThemeToggleProps = {
  headerTone?: SiteHeaderTone;
  /** @deprecated Use `surface` instead. */
  variant?: ChromeSurface;
  surface?: ChromeSurface;
};

/** uses the View Transitions API to perform a circular reveal from the
 * toggle's center when the theme switches. Falls back to instant toggle in
 * browsers without support, or when reduced-motion is preferred.
 */
export function ThemeToggle({
  headerTone = "on-light",
  variant,
  surface: surfaceProp,
}: ThemeToggleProps) {
  const surface = surfaceProp ?? variant ?? "marketing";
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

    if (!canPlayViewTransition()) {
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

    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--theme-toggle-x", `${cx}px`);
    rootStyle.setProperty("--theme-toggle-y", `${cy}px`);
    rootStyle.setProperty("--theme-toggle-radius", `${radius}px`);

    withViewTransition("theme", apply, () => {
      rootStyle.removeProperty("--theme-toggle-x");
      rootStyle.removeProperty("--theme-toggle-y");
      rootStyle.removeProperty("--theme-toggle-radius");
    });
  }, []);

  const label = isDark ? "Switch to light theme" : "Switch to dark theme";
  const icon = isDark ? <Sun aria-hidden /> : <Moon aria-hidden />;
  const className = cn(
    "transition-[color,background-color] duration-300 ease-out motion-reduce:transition-none",
    surface === "shell" ? undefined : headerChromeIconClass(headerTone),
  );

  if (surface === "shell") {
    return (
      <ShellChromeIconButton
        ref={buttonRef}
        label={label}
        onClick={toggle}
        aria-pressed={isDark}
        surface="shell"
        className={className}
      >
        {icon}
      </ShellChromeIconButton>
    );
  }

  return (
    <ChromeIconButton
      ref={buttonRef}
      label={label}
      onClick={toggle}
      aria-pressed={isDark}
      className={className}
    >
      {icon}
    </ChromeIconButton>
  );
}
