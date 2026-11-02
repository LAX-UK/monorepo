import type { HomePressItem } from "@/lib/home-sections/types";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import { HomeSection } from "./home-section";

/** The latest coverage of the house, each a ruled card that opens the article in a new tab. */
export function HomePressSection({ items }: { items: readonly HomePressItem[] }) {
  return (
    <HomeSection id="press" heading="In the press" action={{ href: "/press", label: "Press" }}>
      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3 md:gap-6">
        {items.map((item) => (
          <li key={item.id} className="min-w-0 border-t border-lax-line-strong pt-4">
            <p className="m-0 font-body text-xs leading-4 text-on-surface-variant">{item.label}</p>
            <h3 className="m-0 mt-2 font-headline text-lg font-medium leading-[26px] text-on-surface">
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("rounded-sm underline-offset-4 hover:underline", FOCUS_RING)}
              >
                {item.headline}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </h3>
          </li>
        ))}
      </ul>
    </HomeSection>
  );
}
