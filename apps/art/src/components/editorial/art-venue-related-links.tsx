import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";

const RELATED = [
  { href: "/how-to-buy", label: "How to buy" },
  { href: "/how-to-sell", label: "How to sell" },
  { href: "/collector-hub", label: "Collector Hub" },
] as const;

/** "You may also like" on the cream feature band (Figma `821:11603`); links only, no imagery. */
export function ArtVenueRelatedLinks() {
  return (
    <section
      aria-labelledby="venue-related-title"
      className="bg-[var(--color-surface-feature,var(--color-surface-container-low))] py-12 md:py-16"
    >
      <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-8")}>
        <h2
          id="venue-related-title"
          className="m-0 font-headline text-3xl font-medium text-on-surface md:text-4xl"
        >
          You may also like
        </h2>
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
          {RELATED.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="art-focus-ring flex min-h-24 items-end bg-surface p-6 font-headline text-xl font-medium text-on-surface hover:underline"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
