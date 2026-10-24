"use client";

import { applyTheme } from "@/lib/theme";
import {
  MarketingChromeIconButton,
  MarketingMoonIcon,
  MarketingSunIcon,
} from "@auction/marketing-ui";
import { useEffect, useState } from "react";

/** Light and dark switch, as in the other LAX headers. Starts from the class the theme script set. */
export function AccountThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.classList.contains("dark"));
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <MarketingChromeIconButton
      label={dark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={dark}
      onClick={() => applyTheme(dark ? "light" : "dark")}
    >
      {dark ? <MarketingSunIcon /> : <MarketingMoonIcon />}
    </MarketingChromeIconButton>
  );
}
