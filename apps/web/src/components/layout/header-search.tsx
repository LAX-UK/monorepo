"use client";

import { openCommandPalette } from "@/components/layout/command-palette-events";
import { ShellChromeIconButton } from "@/components/layout/shell-chrome-icon-button";
import { ChromeIconButton } from "@/components/marketing/chrome-icon-button";
import { KbdHint } from "@/components/marketing/kbd-hint";
import type { ChromeSurface } from "@/lib/layout/chrome-surface";
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

type HeaderSearchIconFrom = "default" | "lg";

const HEADER_SEARCH_BAR_FROM: Record<
  HeaderSearchBarFrom,
  Record<HeaderSearchIconFrom, { bar: string; icon: string }>
> = {
  xl: {
    default: {
      bar: "hidden xl:flex xl:w-[231px] xl:flex-none",
      icon: "flex xl:hidden",
    },
    lg: {
      bar: "hidden xl:flex xl:w-[231px] xl:flex-none",
      icon: "hidden lg:flex xl:hidden",
    },
  },
  "2xl": {
    default: {
      bar: "hidden 2xl:flex 2xl:w-[231px] 2xl:flex-none",
      icon: "flex 2xl:hidden",
    },
    lg: {
      bar: "hidden 2xl:flex 2xl:w-[231px] 2xl:flex-none",
      icon: "hidden lg:flex 2xl:hidden",
    },
  },
};

type HeaderSearchLayout = "pill" | "icon" | "both";

type PaletteTriggerProps = {
  className?: string;
  tone?: SiteHeaderTone;
  /** Desktop bar vs mobile drawer row. */
  variant?: "bar" | "drawer";
  /** Min viewport width where the full search bar replaces the icon trigger. */
  fullBarFrom?: HeaderSearchBarFrom;
  onOpen?: () => void;
  surface?: ChromeSurface;
};

export function HeaderSearchPaletteTrigger({
  className = "",
  tone = "on-light",
  variant = "bar",
  fullBarFrom = "xl",
  onOpen,
  surface = "marketing",
}: PaletteTriggerProps) {
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  const open = () => {
    onOpen?.();
    openCommandPalette();
  };

  if (surface === "shell" && variant === "bar") {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={open}
        className={cn(
          "hidden h-12 w-full max-w-[20.75rem] items-center justify-start gap-3 rounded-full border border-shell-stroke bg-shell-search-bg px-4 text-left font-label text-sm font-normal text-on-surface-variant shadow-none hover:bg-shell-search-bg/90 lg:flex",
          className,
        )}
        aria-haspopup="dialog"
        aria-label="Search"
      >
        <Search className="size-5 shrink-0 text-on-surface-variant" aria-hidden />
        <span className="min-w-0 flex-1 truncate">Search...</span>
        <KbdHint className="hidden text-on-surface-variant/80 sm:inline">
          {isMac ? "⌘K" : "Ctrl+K"}
        </KbdHint>
      </Button>
    );
  }

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
        HEADER_SEARCH_BAR_FROM[fullBarFrom].default.bar,
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

function HeaderSearchShellIconTrigger({ className }: { className?: string }) {
  return (
    <ShellChromeIconButton
      label="Open command palette"
      className={cn("shrink-0 lg:hidden", className)}
      onClick={openCommandPalette}
      aria-haspopup="dialog"
    >
      <Search className="size-4" aria-hidden />
    </ShellChromeIconButton>
  );
}

function HeaderSearchIconTrigger({
  className = "",
  tone = "on-light",
  fullBarFrom = "xl",
  iconFrom = "default",
  onOpen,
}: {
  className?: string;
  tone?: SiteHeaderTone;
  fullBarFrom?: HeaderSearchBarFrom;
  iconFrom?: HeaderSearchIconFrom;
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
        HEADER_SEARCH_BAR_FROM[fullBarFrom][iconFrom].icon,
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
  fullBarFrom = "xl",
  iconFrom = "default",
  surface = "marketing",
  layout = "pill",
}: {
  className?: string;
  tone?: SiteHeaderTone;
  fullBarFrom?: HeaderSearchBarFrom;
  /** `lg` shows the icon from lg until `fullBarFrom` (staff shell gap). */
  iconFrom?: HeaderSearchIconFrom;
  surface?: ChromeSurface;
  /** `pill` — bar only; `icon` — icon only; `both` — responsive icon + bar. */
  layout?: HeaderSearchLayout;
}) {
  const showShellIcon = surface === "shell" && (layout === "icon" || layout === "both");
  const showMarketingIcon = surface === "marketing" && (layout === "icon" || layout === "both");
  const showPill = layout === "pill" || layout === "both";

  return (
    <>
      {showShellIcon ? <HeaderSearchShellIconTrigger /> : null}
      {showMarketingIcon ? (
        <HeaderSearchIconTrigger tone={tone} fullBarFrom={fullBarFrom} iconFrom={iconFrom} />
      ) : null}
      {showPill ? (
        <HeaderSearchPaletteTrigger
          className={className}
          tone={tone}
          variant="bar"
          fullBarFrom={fullBarFrom}
          surface={surface}
        />
      ) : null}
    </>
  );
}
