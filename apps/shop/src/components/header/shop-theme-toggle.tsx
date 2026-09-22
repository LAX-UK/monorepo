"use client";

import { applyShopTheme } from "@/lib/theme/shop-theme";
import { revealShopThemeFromToggle } from "@/lib/theme/shop-theme-transition";
import {
  MarketingChromeIconButton,
  type MarketingHeaderTone,
  MarketingMoonIcon,
  MarketingSunIcon,
  headerChromeIconClass,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { useCallback, useEffect, useRef, useState } from "react";

function readDomDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

type ShopThemeToggleProps = {
  headerTone?: MarketingHeaderTone;
};

/** uses the View Transitions API to perform a circular reveal from the
 * toggle's center when the theme switches. Falls back to instant toggle in
 * browsers without support, or when reduced-motion is preferred.
 */
export function ShopThemeToggle({ headerTone = "on-light" }: ShopThemeToggleProps) {
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
      applyShopTheme(mode);
      setIsDark(next);
    };

    revealShopThemeFromToggle(buttonRef.current, apply);
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
