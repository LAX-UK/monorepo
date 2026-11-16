"use client";

import { ShellChromeIconButton } from "@/components/layout/shell-chrome-icon-button";
import { ChromeIconButton } from "@/components/marketing/chrome-icon-button";
import { syncUiThemeFromClientAction } from "@/lib/actions/user-ui-preferences";
import type { ChromeSurface } from "@/lib/layout/chrome-surface";
import { type SiteHeaderTone, headerChromeIconClass } from "@/lib/layout/header-chrome-tone";
import { applyThemeDom } from "@/lib/preferences/apply-theme-dom";
import { revealThemeFromToggle } from "@auction/marketing-ui/motion/theme-view-transition";
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

/** The LAX theme switch: the shared circular reveal from the pressed toggle
 * (`revealThemeFromToggle` in `@auction/marketing-ui`, the same code as LAX Shop and lax.art). It
 * marks `<html data-view-transition="theme">` while it runs and switches instantly without support
 * or under reduced motion (the in-app switch wins over the OS preference).
 *
 * It does not import the page-change helper (`view-transition-runtime.ts`): the toggle ships in
 * every layout, and that helper also lives in the page chunks that navigate.
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

    // A keyboard press clicks the same button, so the wipe grows from the pressed button.
    revealThemeFromToggle(event.currentTarget, apply);
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
