import { cn } from "@auction/ui";
import { X } from "lucide-react";
import Link from "next/link";

export type CatalogActiveFilterChip = {
  id: string;
  label: string;
  clearHref: string;
};

type Props = {
  chips: readonly CatalogActiveFilterChip[];
  className?: string;
};

/** Dismissible chips for URL-driven catalog filters (GET links). */
export function CatalogActiveFiltersRow({ chips, className }: Props) {
  if (chips.length === 0) return null;

  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Active filters">
      {chips.map((chip) => (
        <li key={chip.id}>
          <Link
            href={chip.clearHref}
            scroll={false}
            className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-outline-variant/50 bg-surface-container-low px-3 py-1.5 font-body text-sm text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="truncate">{chip.label}</span>
            <X className="size-3.5 shrink-0 text-on-surface-variant" aria-hidden />
            <span className="sr-only">Remove {chip.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
