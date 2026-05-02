import { cn } from "@auction/ui";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

export type AttentionListItem = {
  id: string;
  title: string;
  hint: string;
  href: string;
  ctaLabel?: string;
};

type AttentionListProps = {
  items: readonly AttentionListItem[];
  emptyLabel?: string;
  className?: string;
};

export function AttentionList({
  items,
  emptyLabel = "Nothing urgent right now.",
  className,
}: AttentionListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-on-surface-variant">{emptyLabel}</p>;
  }

  return (
    <ul className={cn("space-y-2", className)}>
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="group flex min-h-12 items-center justify-between gap-3 rounded-lg border border-outline-variant/15 bg-surface-container-low/45 px-3 py-2 transition-colors hover:border-primary/25 hover:bg-surface-container-high/55"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-headline text-sm text-on-surface">
                {item.title}
              </span>
              <span className="block font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
                {item.hint}
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 font-label text-xs font-semibold uppercase tracking-widest text-primary">
              {item.ctaLabel ?? "Open"}
              <ChevronRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
