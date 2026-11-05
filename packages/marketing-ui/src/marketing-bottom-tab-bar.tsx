"use client";

import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import { useEffect } from "react";
import {
  type MarketingBottomTab,
  type MarketingBottomTabBadge,
  badgeCountText,
  isTabCurrent,
} from "./bottom-bar/bottom-tab-config.js";
import { useBottomBarVisibility } from "./bottom-bar/use-bottom-bar-visibility.js";

export type MarketingBottomTabBarProps = {
  tabs: readonly MarketingBottomTab[];
  /** The current path, from the router. */
  pathname: string;
  /** Opens the product's existing search dialog; used by the tab whose `action` is "search". */
  onSearch: () => void;
  /** Colour of the current tab and its indicator (a CSS colour); defaults to the theme primary. */
  accent?: string;
  /** The same accent in dark mode. */
  accentOnDark?: string;
  /** Hides the bar from outside, e.g. while the product's own phone menu is open. */
  hidden?: boolean;
  ariaLabel?: string;
  className?: string;
  "data-testid"?: string;
};

const TAB_BASE =
  "relative flex h-14 w-full flex-col items-center justify-center gap-0.5 font-label text-[11px] leading-none text-on-surface-variant transition-colors hover:text-on-surface motion-reduce:transition-none";
const TAB_CURRENT =
  "font-semibold text-[var(--lax-tab-accent)] dark:text-[var(--lax-tab-accent-dark,var(--lax-tab-accent))] after:absolute after:inset-x-5 after:top-0 after:h-0.5 after:rounded-full after:bg-[var(--lax-tab-accent)] dark:after:bg-[var(--lax-tab-accent-dark,var(--lax-tab-accent))]";

function Badge({ badge, label }: { badge: MarketingBottomTabBadge; label: string }) {
  if (badge.kind === "dot") {
    return (
      <span
        aria-hidden
        data-testid={`tab-badge-${label}`}
        className="absolute top-1.5 left-1/2 ml-2 size-2 rounded-full bg-danger"
      />
    );
  }
  const text = badgeCountText(badge.count);
  if (!text) return null;
  return (
    <span
      aria-hidden
      data-testid={`tab-badge-${label}`}
      className="absolute top-1 left-1/2 ml-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 font-label text-[10px] font-semibold leading-4 text-danger-on-solid"
    >
      {text}
    </span>
  );
}

/** What a screen reader hears for a badge, appended to the tab's name. */
function badgeSpeech(badge: MarketingBottomTabBadge | null | undefined): string {
  if (!badge) return "";
  if (badge.kind === "dot") return ", needs attention";
  const text = badgeCountText(badge.count);
  return text ? `, ${text} items` : "";
}

/**
 * The docked bottom bar on phones: five shortcuts, each a 24px icon over an 11px label in a 56px
 * row plus the safe area. It shows below 768px only. Tabs are plain links (the current one has
 * `aria-current="page"` and a 2px indicator); the search tab is a button. It hides, and becomes
 * `inert`, while the keyboard is up, a modal is open, or another bar holds the bottom slot.
 */
export function MarketingBottomTabBar({
  tabs,
  pathname,
  onSearch,
  accent,
  accentOnDark,
  hidden = false,
  ariaLabel = "Shortcuts",
  className,
  "data-testid": testId = "marketing-bottom-tab-bar",
}: MarketingBottomTabBarProps) {
  const { visible, reason } = useBottomBarVisibility({ forceHidden: hidden });

  // Tells the page's single bottom spacer (see marketing-ui.css) that a bar is mounted.
  useEffect(() => {
    document.documentElement.setAttribute("data-lax-bottom-bar", "");
    return () => document.documentElement.removeAttribute("data-lax-bottom-bar");
  }, []);

  const style = {
    ...(accent ? { "--lax-tab-accent": accent } : { "--lax-tab-accent": "var(--color-primary)" }),
    ...(accentOnDark ? { "--lax-tab-accent-dark": accentOnDark } : {}),
  } as React.CSSProperties;

  return (
    <nav
      aria-label={ariaLabel}
      data-testid={testId}
      data-visible={visible ? "true" : "false"}
      data-hidden-reason={reason ?? undefined}
      inert={!visible}
      style={style}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/40 bg-surface pb-[env(safe-area-inset-bottom,0px)] transition-opacity duration-150 motion-reduce:transition-none md:hidden",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
        className,
      )}
    >
      <ul
        className="m-0 grid list-none p-0"
        style={{ gridTemplateColumns: `repeat(${Math.max(tabs.length, 1)}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const current = tab.href !== undefined && isTabCurrent(tab, pathname);
          const inner = (
            <>
              <span className="relative flex size-6 items-center justify-center [&>svg]:size-6">
                {tab.icon}
                {tab.badge ? <Badge badge={tab.badge} label={tab.label} /> : null}
              </span>
              <span>{tab.label}</span>
            </>
          );
          return (
            <li key={tab.key}>
              {tab.action === "search" ? (
                <button
                  type="button"
                  onClick={onSearch}
                  aria-haspopup="dialog"
                  className={cn(TAB_BASE, FOCUS_RING)}
                >
                  {inner}
                </button>
              ) : tab.fullPageNavigation ? (
                <a
                  href={tab.href}
                  aria-current={current ? "page" : undefined}
                  aria-label={`${tab.label}${badgeSpeech(tab.badge)}`}
                  className={cn(TAB_BASE, current && TAB_CURRENT, FOCUS_RING)}
                >
                  {inner}
                </a>
              ) : (
                <Link
                  href={tab.href}
                  aria-current={current ? "page" : undefined}
                  aria-label={`${tab.label}${badgeSpeech(tab.badge)}`}
                  className={cn(TAB_BASE, current && TAB_CURRENT, FOCUS_RING)}
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The one spacer at the end of the page that keeps content clear of the docked bar. Cookie docks
 * and toasts sit above it with `BOTTOM_BAR_ABOVE_CLASS`; nothing else reserves this space.
 */
export function MarketingBottomBarSpace() {
  return (
    <div
      aria-hidden
      data-testid="bottom-bar-space"
      className="h-[var(--lax-bottom-bar-space,0px)]"
    />
  );
}

/** Raise a bottom-fixed element (cookie dock, toast stack) above the docked bar. */
export const BOTTOM_BAR_ABOVE_CLASS = "bottom-[var(--lax-bottom-bar-space,0px)]";
