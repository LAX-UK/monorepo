import { ArtEditorialLink } from "@/components/editorial/art-editorial-link";
import type { ArtHubPressRowVm } from "@/lib/editorial/art-hub.vm";
import { ART_HUB_HEADINGS } from "@/lib/editorial/art-hub.vm";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import {
  MarketingEditorialListRow,
  MarketingViewAllChevron,
  MarketingViewAllLink,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

/** Inverse band of press coverage (Figma Arthub `980:26767`); rows leave the site for the original article. */
export function ArtHubPressBand({ rows }: { rows: readonly ArtHubPressRowVm[] }) {
  return (
    <section
      aria-labelledby="art-hub-press-title"
      className="bg-surface-inverse py-16 text-on-surface-inverse md:py-24"
      data-testid="art-hub-press"
    >
      <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-8")}>
        <div className="flex items-end justify-between gap-4">
          <h2
            id="art-hub-press-title"
            className="font-headline text-[length:var(--text-title-section)] font-medium leading-[1.2]"
          >
            {ART_HUB_HEADINGS.press}
          </h2>
          <MarketingViewAllLink asChild className="text-inherit">
            <Link href="/stories/press">
              View all
              <span className="sr-only"> press</span>
              <MarketingViewAllChevron />
            </Link>
          </MarketingViewAllLink>
        </div>
        <ul className="flex flex-col border-t border-current/30">
          {rows.map((row) => (
            <li key={row.key}>
              <MarketingEditorialListRow
                tone="inverse"
                title={row.title}
                kicker={row.publication}
                meta={row.date}
                href={row.href}
                linkAs={ArtEditorialLink}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
