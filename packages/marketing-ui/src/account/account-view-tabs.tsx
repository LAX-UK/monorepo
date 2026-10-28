import { cn } from "@auction/ui";
import Link from "next/link";

export type AccountViewTab = {
  id: string;
  label: string;
  href: string;
  /** How many items the view holds; hidden when absent. Zero still shows, so a view never looks broken. */
  count?: number | null;
};

export type AccountViewTabsProps = {
  /** Names the control for assistive tech ("Bids", "Purchases"). */
  label: string;
  tabs: readonly AccountViewTab[];
  /** Id of the view in use. */
  currentId: string;
  className?: string;
};

/**
 * Views of the same list on an account page (Active / Won / Not won). Shaped as a segmented
 * pill on purpose, so it never reads as the account sub-navigation's underlined links. Each view
 * is a link, so it survives a reload and can be shared. Full width on phones.
 */
export function AccountViewTabs({ label, tabs, currentId, className }: AccountViewTabsProps) {
  return (
    <nav aria-label={label} className={cn("max-md:w-full", className)}>
      <ul className="flex w-full gap-1 rounded-lg bg-surface-container p-1 md:inline-flex md:w-auto">
        {tabs.map((tab) => {
          const current = tab.id === currentId;
          return (
            <li key={tab.id} className="flex max-md:flex-1">
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md px-3.5 font-body text-sm",
                  "motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                  current
                    ? "bg-surface-container-lowest font-medium text-on-surface shadow-sm ring-1 ring-outline-variant/50"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                )}
              >
                {tab.label}
                {tab.count != null ? (
                  <span className="font-body text-xs tabular-nums text-on-surface-variant">
                    <span aria-hidden>{tab.count}</span>
                    <span className="sr-only">, {tab.count}</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
