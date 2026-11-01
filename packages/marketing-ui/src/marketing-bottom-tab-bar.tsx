import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export type MarketingBottomTabItem = {
  href: string;
  label: string;
  icon?: ReactNode;
  active: boolean;
};

export type MarketingBottomTabBarProps = {
  items: readonly MarketingBottomTabItem[];
  /** Landmark name; defaults to “Mobile”. */
  ariaLabel?: string;
  /**
   * `floating` is an inset rounded pill with a filled active tab (lax.art Figma `546:9946`).
   * It sits 1rem above the safe area and is 66px tall, so pages reserve that space below it.
   */
  variant?: "default" | "floating";
  className?: string;
  "data-testid"?: string;
};

const NAV_CLASS = {
  default:
    "fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/40 bg-surface pb-[env(safe-area-inset-bottom,0px)] md:hidden",
  floating:
    "fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-40 rounded-full border border-outline-variant/40 bg-surface/90 p-1 shadow-lg backdrop-blur-md md:hidden",
} as const;

function tabClass(variant: "default" | "floating", active: boolean): string {
  if (variant === "floating") {
    return cn(
      "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-full font-label text-xs font-medium transition-colors motion-reduce:transition-none",
      active
        ? "bg-surface-container-high text-on-surface"
        : "text-on-surface-variant hover:text-on-surface",
    );
  }
  return cn(
    "relative flex min-h-14 flex-col items-center justify-center gap-1 font-label text-xs transition-colors motion-reduce:transition-none",
    active
      ? "text-on-surface after:absolute after:inset-x-6 after:top-0 after:h-0.5 after:rounded-full after:bg-primary"
      : "text-on-surface-variant hover:text-on-surface",
  );
}

/** Fixed mobile tab bar below `md`; active tab is exposed with `aria-current="page"`. */
export function MarketingBottomTabBar({
  items,
  ariaLabel = "Mobile",
  variant = "default",
  className,
  "data-testid": testId,
}: MarketingBottomTabBarProps) {
  return (
    <nav
      aria-label={ariaLabel}
      data-testid={testId}
      data-variant={variant}
      className={cn(NAV_CLASS[variant], className)}
    >
      <ul
        className="grid"
        style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(tabClass(variant, item.active), FOCUS_RING)}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
