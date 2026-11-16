"use client";

import { applyArtTheme } from "@/lib/theme/art-theme";
import {
  MarketingChromeIconButton,
  type MarketingHeaderTone,
  MarketingMoonIcon,
  MarketingSunIcon,
  headerChromeIconClass,
} from "@auction/marketing-ui";
import { revealThemeFromToggle } from "@auction/marketing-ui/motion/theme-view-transition";
import { cn } from "@auction/ui";
import { useCallback, useEffect, useRef, useState } from "react";

function readDomDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

type ArtThemeToggleProps = {
  headerTone?: MarketingHeaderTone;
};

/** The LAX theme switch: the shared circular reveal from the toggle's centre
 * (`revealThemeFromToggle`, the same code as LAX Bid). Switches instantly without
 * View Transitions support or under reduced motion.
 */
export function ArtThemeToggle({ headerTone = "on-light" }: ArtThemeToggleProps) {
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
      applyArtTheme(mode);
      setIsDark(next);
    };

    revealThemeFromToggle(buttonRef.current, apply);
  }, []);

  const label = isDark ? "Switch to light theme" : "Switch to dark theme";
  const icon = isDark ? <MarketingSunIcon /> : <MarketingMoonIcon />;

  return (
    <MarketingChromeIconButton
      ref={buttonRef}
      label={label}
      onClick={toggle}
      aria-pressed={isDark}
      className={cn(
        "transition-[color,background-color] duration-300 ease-out motion-reduce:transition-none",
        headerChromeIconClass(headerTone),
      )}
    >
      {icon}
    </MarketingChromeIconButton>
  );
}
