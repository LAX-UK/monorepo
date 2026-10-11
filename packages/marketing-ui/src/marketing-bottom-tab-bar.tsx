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
  className?: string;
  "data-testid"?: string;
};

/** Fixed mobile tab bar below `md`; active tab is exposed with `aria-current="page"`. */
export function MarketingBottomTabBar({
  items,
  ariaLabel = "Mobile",
  className,
  "data-testid": testId,
}: MarketingBottomTabBarProps) {
  return (
    <nav
      aria-label={ariaLabel}
      data-testid={testId}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/40 bg-surface pb-[env(safe-area-inset-bottom,0px)] md:hidden",
        className,
      )}
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
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-1 font-label text-[0.65rem] uppercase tracking-wide transition-colors motion-reduce:transition-none",
                FOCUS_RING,
                item.active
                  ? "text-on-surface after:absolute after:inset-x-6 after:top-0 after:h-0.5 after:rounded-full after:bg-primary"
                  : "text-on-surface-variant hover:text-on-surface",
              )}
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
