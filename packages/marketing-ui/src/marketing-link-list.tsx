import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import { MarketingArrowRightIcon } from "./marketing-icons.js";

export type MarketingLinkListItem = {
  label: string;
  href: string;
};

export type MarketingLinkListProps = {
  ariaLabel: string;
  items: readonly MarketingLinkListItem[];
  className?: string;
};

/** Hairline-separated arrow rows for quick links (Figma Art Hub hero, `980:26767`). */
export function MarketingLinkList({ ariaLabel, items, className }: MarketingLinkListProps) {
  return (
    <nav aria-label={ariaLabel} className={className}>
      <ul className="m-0 flex list-none flex-col border-t border-current/20 p-0">
        {items.map((item) => (
          <li key={item.href} className="border-b border-current/20">
            <Link
              href={item.href}
              className={cn(
                "group flex min-h-11 items-center justify-between gap-4 py-3 font-headline text-lg font-medium",
                FOCUS_RING,
              )}
            >
              <span className="underline-offset-4 group-hover:underline">{item.label}</span>
              <MarketingArrowRightIcon className="transition-transform motion-safe:group-hover:translate-x-1" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
