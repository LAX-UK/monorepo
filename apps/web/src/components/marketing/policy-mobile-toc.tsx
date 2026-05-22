import { cn } from "@auction/ui";
import type { TocNavItem } from "@auction/ui";
import Link from "next/link";

type Props = {
  items: readonly TocNavItem[];
  className?: string;
};

/** Collapsible jump nav for long policy pages on small screens. */
export function PolicyMobileToc({ items, className }: Props) {
  if (items.length === 0) return null;

  return (
    <details
      className={cn(
        "mb-8 rounded-lg border border-border-hairline bg-surface-container-low/40 md:hidden",
        className,
      )}
    >
      <summary className="cursor-pointer list-none px-4 py-3 font-label text-xs font-semibold uppercase tracking-[0.12em] text-on-surface [&::-webkit-details-marker]:hidden">
        On this page
      </summary>
      <nav aria-label="On this page" className="border-t border-border-hairline px-4 py-3">
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`#${item.id}`}
                className="font-body text-sm text-on-surface-variant hover:text-primary"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}
