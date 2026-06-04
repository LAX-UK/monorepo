import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";

export type SiteHeaderTone = "on-dark" | "on-light";

/** Shared marketing header chrome class — paired with `data-header-tone` overrides in globals.css. */
export const SITE_HEADER_CHROME = "site-header-chrome";

export function headerChromeIconClass(tone: SiteHeaderTone, extra?: string): string {
  return cn(
    SITE_HEADER_CHROME,
    "site-header-chrome-icon bg-transparent",
    tone === "on-dark"
      ? "text-hero-foreground hover:bg-white/10 dark:text-hero-foreground"
      : "text-brand-800 hover:bg-page-bg dark:text-on-surface dark:hover:bg-surface-container-low",
    extra,
  );
}

export function headerUtilityLinkClass(
  tone: SiteHeaderTone,
  current: boolean,
  extra?: string,
): string {
  return cn(
    SITE_HEADER_CHROME,
    "rounded-sm font-label text-sm font-medium uppercase leading-[21px] transition-colors",
    FOCUS_RING,
    tone === "on-dark"
      ? current
        ? "text-hero-foreground"
        : "text-hero-foreground/80 hover:text-hero-foreground"
      : current
        ? "text-brand-900 dark:text-on-surface"
        : "text-nav-text hover:text-brand-900",
    extra,
  );
}

export function headerSearchTriggerClass(tone: SiteHeaderTone, extra?: string): string {
  return cn(
    SITE_HEADER_CHROME,
    "site-header-search-trigger bg-transparent hover:bg-transparent",
    tone === "on-dark"
      ? "border-hero-foreground/35 hover:border-hero-foreground/55"
      : "border-brand-300 hover:border-brand-400 dark:border-outline-variant/50 dark:hover:border-outline-variant",
    extra,
  );
}

export function headerMegaNavTriggerClass(
  tone: SiteHeaderTone,
  opts: { active: boolean; open: boolean },
  extra?: string,
): string {
  const { active, open } = opts;
  return cn(
    SITE_HEADER_CHROME,
    "site-header-mega-trigger",
    "group h-auto gap-1 rounded-none border-b-2 bg-transparent px-0 pb-1 font-label text-sm font-medium uppercase leading-[21px] hover:bg-transparent motion-reduce:transition-none",
    tone === "on-dark"
      ? active || open
        ? "border-hero-foreground text-hero-foreground"
        : "border-transparent text-hero-foreground/85 hover:border-hero-foreground/45 hover:text-hero-foreground"
      : active || open
        ? "border-brand-900 text-brand-900 dark:border-on-surface dark:text-on-surface"
        : "border-transparent text-nav-text hover:border-brand-900/40 hover:text-brand-900 dark:hover:border-on-surface/40 dark:hover:text-on-surface",
    open && tone === "on-light" ? "border-brand-900 dark:border-on-surface" : "",
    extra,
  );
}

export function headerMegaNavChevronClass(
  tone: SiteHeaderTone,
  open: boolean,
  extra?: string,
): string {
  return cn(
    SITE_HEADER_CHROME,
    "text-base! transition-[transform,color] duration-200 motion-reduce:transition-none",
    tone === "on-dark" ? "text-hero-foreground" : "text-brand-900 dark:text-on-surface",
    open ? "rotate-180" : "rotate-0",
    extra,
  );
}
