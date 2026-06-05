"use client";

import { openCommandPalette } from "@/components/layout/command-palette-events";
import { ChromeIconButton } from "@/components/marketing/chrome-icon-button";
import { KbdHint } from "@/components/marketing/kbd-hint";
import {
  SITE_HEADER_CHROME,
  type SiteHeaderTone,
  headerChromeIconClass,
  headerSearchTriggerClass,
} from "@/lib/layout/header-chrome-tone";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

type HeaderSearchBarFrom = "xl" | "2xl";

const HEADER_SEARCH_BAR_FROM: Record<HeaderSearchBarFrom, { bar: string; icon: string }> = {
  xl: {
    bar: "hidden xl:flex xl:w-[231px] xl:flex-none",
    icon: "flex xl:hidden",
  },
  "2xl": {
    bar: "hidden 2xl:flex 2xl:w-[231px] 2xl:flex-none",
    icon: "flex 2xl:hidden",
  },
};

type PaletteTriggerProps = {
  className?: string;
  tone?: SiteHeaderTone;
  /** Desktop bar vs mobile drawer row. */
  variant?: "bar" | "drawer";
  /** Min viewport width where the full search bar replaces the icon trigger. */
  fullBarFrom?: HeaderSearchBarFrom;
  onOpen?: () => void;
};

export function HeaderSearchPaletteTrigger({
  className = "",
  tone = "on-light",
  variant = "bar",
  fullBarFrom = "xl",
  onOpen,
}: PaletteTriggerProps) {
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  const open = () => {
    onOpen?.();
    openCommandPalette();
  };

  if (variant === "drawer") {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={open}
        className={cn(
          "h-auto min-h-11 w-full justify-start gap-2 rounded-none border-b px-0 py-0 text-left hover:bg-transparent",
          headerSearchTriggerClass(tone, className),
        )}
        aria-haspopup="dialog"
        aria-label="Search"
      >
        <Search
          className={cn(SITE_HEADER_CHROME, "site-header-search-icon shrink-0")}
          aria-hidden
        />
        <span
          className={cn(
            SITE_HEADER_CHROME,
            "site-header-search-placeholder min-w-0 flex-1 truncate py-2 font-label text-sm font-medium leading-[21px]",
          )}
        >
          Search lots, artists, sales…
        </span>
        <KbdHint className={cn(SITE_HEADER_CHROME, "site-header-search-kbd shrink-0")}>
          {isMac ? "⌘K" : "Ctrl+K"}
        </KbdHint>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={open}
      className={cn(
        "min-h-11 min-w-0 flex-1 items-center justify-start gap-2 rounded-none border-b px-0 py-0 text-left transition-[border-color,color,opacity] duration-300 ease-out hover:bg-transparent motion-reduce:transition-none",
        HEADER_SEARCH_BAR_FROM[fullBarFrom].bar,
        headerSearchTriggerClass(tone, className),
      )}
      aria-haspopup="dialog"
      aria-label="Search"
    >
      <Search className={cn(SITE_HEADER_CHROME, "site-header-search-icon shrink-0")} aria-hidden />
      <span
        className={cn(
          SITE_HEADER_CHROME,
          "site-header-search-placeholder min-w-0 flex-1 truncate py-2 font-label text-sm font-medium leading-[21px]",
        )}
      >
        Search lots, artists, sales…
      </span>
      <KbdHint className={cn(SITE_HEADER_CHROME, "site-header-search-kbd hidden sm:inline")}>
        {isMac ? "⌘K" : "Ctrl+K"}
      </KbdHint>
    </Button>
  );
}

function HeaderSearchIconTrigger({
  className = "",
  tone = "on-light",
  fullBarFrom = "xl",
  onOpen,
}: {
  className?: string;
  tone?: SiteHeaderTone;
  fullBarFrom?: HeaderSearchBarFrom;
  onOpen?: () => void;
}) {
  const open = () => {
    onOpen?.();
    openCommandPalette();
  };

  return (
    <ChromeIconButton
      label="Open search"
      className={cn(
        HEADER_SEARCH_BAR_FROM[fullBarFrom].icon,
        headerChromeIconClass(tone, className),
      )}
      onClick={open}
      aria-haspopup="dialog"
    >
      <Search aria-hidden />
    </ChromeIconButton>
  );
}

export function HeaderSearchTrigger({
  className = "",
  tone = "on-light",
  showIcon = false,
  fullBarFrom = "xl",
}: {
  className?: string;
  tone?: SiteHeaderTone;
  /** Icon-only trigger below `fullBarFrom` (marketing header). */
  showIcon?: boolean;
  fullBarFrom?: HeaderSearchBarFrom;
}) {
  return (
    <>
      {showIcon ? <HeaderSearchIconTrigger tone={tone} fullBarFrom={fullBarFrom} /> : null}
      <HeaderSearchPaletteTrigger
        className={className}
        tone={tone}
        variant="bar"
        fullBarFrom={fullBarFrom}
      />
    </>
  );
}
