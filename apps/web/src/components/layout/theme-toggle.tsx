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
  surface?: ChromeSurface;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

/** Circular reveal from the toggle's centre when the theme switches (View Transitions API).
 *
 * The transition is marked `<html data-view-transition="theme">` so `marketing-header.css` plays
 * the wipe for this switch only, with the same marking order as the page-change helper
 * (`view-transition-runtime.ts`): set inside the update callback, cleared when `finished`
 * settles, so a superseded switch or page change has always cleaned up before the next marker is
 * set. Switches instantly without support or under reduced motion, resolved as
 * `useReducedMotion` does (the in-app switch wins over the OS preference).
 *
 * Self-contained on purpose: the toggle ships in every layout, and importing the helper put it in
 * the layout chunk as well as the page chunks that navigate, growing route JS everywhere.
 */
export function ThemeToggle({ headerTone = "on-light", surface = "marketing" }: ThemeToggleProps) {
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

    const doc: ViewTransitionDocument = document;
    const root = doc.documentElement;
    const override = root.dataset.reduceMotion;
    if (
      !doc.startViewTransition ||
      override === "force-reduce" ||
      (override !== "force-allow" && matchMedia("(prefers-reduced-motion: reduce)").matches)
    ) {
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
    const cleanup = () => {
      delete root.dataset.viewTransition;
      root.style.removeProperty("--theme-toggle-at");
      root.style.removeProperty("--theme-toggle-radius");
    };
    // `finished` rejects only if the update throws; clean up either way.
    void doc
      .startViewTransition(() => {
        root.dataset.viewTransition = "theme";
        root.style.setProperty("--theme-toggle-at", `${cx}px ${cy}px`);
        root.style.setProperty("--theme-toggle-radius", `${radius}px`);
        apply();
      })
      .finished.then(cleanup, cleanup);
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
