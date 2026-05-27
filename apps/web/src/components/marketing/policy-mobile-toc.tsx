"use client";

import type { TocNavItem } from "@auction/ui";
import { cn } from "@auction/ui/lib/utils";
import Link from "next/link";

import { CollapsibleSection } from "@/components/ui/collapsible-section";

type Props = {
  items: readonly TocNavItem[];
  className?: string;
};

/** Collapsible jump nav for long policy pages on small screens. */
export function PolicyMobileToc({ items, className }: Props) {
  if (items.length === 0) return null;

  return (
    <CollapsibleSection title="On this page" className={cn("mb-8 md:hidden", className)}>
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
    </CollapsibleSection>
  );
}
