import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

/** Definition for a single tab in {@link UnderlineTabs}.
 *
 * - `id` is matched against the `active` prop to flag the current tab.
 * - `href` is consumed by `next/link`; tabs are intentionally URL-driven so
 *   their state is shareable and the back button works as expected.
 */
export type UnderlineTab<Id extends string> = {
  id: Id;
  label: string;
  href: string;
  /** Optional trailing badge (count, dot, etc.) */
  badge?: ReactNode;
};

type UnderlineTabsProps<Id extends string> = {
  ariaLabel: string;
  active: Id;
  tabs: ReadonlyArray<UnderlineTab<Id>>;
  className?: string;
  /** When false, prevents native browser scroll-to-top on tab navigation. Defaults to false. */
  scrollOnNav?: boolean;
};

/** Editorial underline tab nav (active tab gets `border-on-surface`).
 *
 * Generic over the tab id so callers retain narrow types at the consumption
 * site. The component is presentational only — it does not read or write
 * URL state itself; callers pass `active` and `href`.
 */
export function UnderlineTabs<Id extends string>({
  ariaLabel,
  active,
  tabs,
  className,
  scrollOnNav = false,
}: UnderlineTabsProps<Id>) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn("flex w-full flex-wrap gap-6 border-b border-outline-variant/60", className)}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            scroll={scrollOnNav}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex min-h-10 items-center gap-2 border-b-2 pb-2 font-label text-sm font-medium uppercase tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              isActive
                ? "border-on-surface text-on-surface"
                : "border-transparent text-on-surface-variant hover:text-on-surface",
            )}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined ? <span>{tab.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
