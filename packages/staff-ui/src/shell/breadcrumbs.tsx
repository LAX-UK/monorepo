import type { LinkComponent } from "@auction/ui/lax";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/cn.js";
import type { StaffBreadcrumb } from "./types.js";

/**
 * Where this page sits: section, then parent records, then the page itself (not a link). Long
 * trails collapse the middle on a phone so the current page stays readable.
 */
export function StaffBreadcrumbs({
  items,
  Link,
  className,
}: {
  items: readonly StaffBreadcrumb[];
  Link: LinkComponent;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1 text-staff-sm">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          const hiddenOnPhone = !last && index > 0 && index < items.length - 1;
          return (
            <li
              key={`${item.label}-${index}`}
              className={cn("flex min-w-0 items-center gap-1", hiddenOnPhone && "hidden sm:flex")}
            >
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="staff-focus truncate rounded-staff-xs text-staff-muted transition-colors hover:text-staff-fg"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="truncate font-medium text-staff-fg"
                  {...(last ? { "aria-current": "page" as const } : {})}
                >
                  {item.label}
                </span>
              )}
              {last ? null : (
                <ChevronRight aria-hidden className="size-3.5 shrink-0 text-staff-subtle" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
