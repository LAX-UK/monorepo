"use client";

import { ShellChromeIconButton } from "@/components/layout/shell-chrome-icon-button";
import { ChromeIconButton } from "@/components/marketing/chrome-icon-button";
import { syncUiThemeFromClientAction } from "@/lib/actions/user-ui-preferences";
import type { ChromeSurface } from "@/lib/layout/chrome-surface";
import { type SiteHeaderTone, headerChromeIconClass } from "@/lib/layout/header-chrome-tone";
import { applyThemeDom } from "@/lib/preferences/apply-theme-dom";
import { cn } from "@auction/ui/lib/utils";
import { Moon, Sun } from "lucide-react";
import { type MouseEvent, useCallback, useEffect, useState } from "react";

function readDomDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

type ThemeToggleProps = {
  headerTone?: SiteHeaderTone;
  /** @deprecated Use `surface` instead. */
  variant?: ChromeSurface;
  surface?: ChromeSurface;
};

/** The latest theme switch's marker; an older switch that ends late must leave the newer one's wipe alone. */
let latestThemeTransition: object | undefined;

/** Reduced motion as `useReducedMotion` resolves it: the in-app switch wins over the OS preference. */
function themeMotionReduced(root: HTMLElement): boolean {
  const override = root.dataset.reduceMotion;
  if (override === "force-reduce") return true;
  if (override === "force-allow") return false;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Circular reveal from the toggle's centre when the theme switches (View Transitions API), marked
 * `<html data-view-transition="theme">` so `marketing-header.css` plays the wipe for this switch
 * only. Switches instantly without support or under reduced motion. Self-contained on purpose: it
 * ships in every layout, so it shares no module with the page-change helper
 * (`view-transition-runtime.ts`), which would otherwise be duplicated into the layout chunk.
 */
export function ThemeToggle({
  headerTone = "on-light",
  variant,
  surface: surfaceProp,
}: ThemeToggleProps) {
  const surface = surfaceProp ?? variant ?? "marketing";
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(readDomDark());
    const root = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(readDomDark()));
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const toggle = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const next = !readDomDark();
    const mode = next ? "dark" : "light";
    const apply = () => {
      applyThemeDom(mode);
      setIsDark(next);
      void syncUiThemeFromClientAction({ theme: mode });
    };

    const root = document.documentElement;
    const doc = document as Document & {
      startViewTransition?: (update: () => void) => { finished: Promise<void> };
    };
    if (!doc.startViewTransition || themeMotionReduced(root)) {
      apply();
      return;
    }

    // The wipe grows from the pressed button's centre (a keyboard press clicks the same button).
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(cx, window.innerWidth - cx),
      Math.max(cy, window.innerHeight - cy),
    );
    const vars = {
      "--theme-toggle-x": cx,
      "--theme-toggle-y": cy,
      "--theme-toggle-radius": radius,
    };
    for (const [name, px] of Object.entries(vars)) root.style.setProperty(name, `${px}px`);

    const mine = {};
    latestThemeTransition = mine;
    root.dataset.viewTransition = "theme";
    // Runs when this transition ends, also when a page change replaced it. Only a newer theme
    // switch (which set fresh values) skips it; the marker stays when another kind owns it now.
    const cleanup = () => {
      if (mine !== latestThemeTransition) return;
      if (root.dataset.viewTransition === "theme") delete root.dataset.viewTransition;
      for (const name in vars) root.style.removeProperty(name);
    };
    try {
      // `finished` rejects when the transition is aborted; the theme has been applied by then.
      void doc.startViewTransition(apply).finished.then(cleanup, cleanup);
    } catch {
      apply();
      cleanup();
    }
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
    <ChromeIconButton label={label} onClick={toggle} aria-pressed={isDark} className={className}>
      {icon}
    </ChromeIconButton>
  );
}
