import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { MarketingFilterLink } from "./marketing-filter-link-groups.js";

export type MarketingSortLinksProps = {
  options: readonly MarketingFilterLink[];
  label?: string;
  className?: string;
};

/** Sort options as a row of link chips for directory toolbars (desktop). */
export function MarketingSortLinks({
  options,
  label = "Sort",
  className,
}: MarketingSortLinksProps) {
  return (
    <nav aria-label={label} className={cn("flex flex-wrap items-center gap-2", className)}>
      <span aria-hidden className="shrink-0 font-body text-sm text-on-surface-variant">
        {label}
      </span>
      <ul className="flex flex-wrap items-center gap-1.5">
        {options.map((option) => (
          <li key={option.href}>
            <Link
              href={option.href}
              aria-current={option.active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center whitespace-nowrap rounded-full px-3 font-body text-sm transition-colors motion-reduce:transition-none",
                FOCUS_RING,
                option.active
                  ? "bg-primary font-medium text-on-primary"
                  : "text-on-surface-variant ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low hover:text-on-surface",
              )}
            >
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
