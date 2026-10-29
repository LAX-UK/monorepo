import type { UpcomingSaleView } from "@/lib/organisation-home/organisation-dashboard-view";
import { cn } from "@auction/ui";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { HOME_CELL_LINK_CLASS } from "./home-cell-grid";
import { HomePanel, HomeSection } from "./home-section";

type Props = {
  sales: readonly UpcomingSaleView[];
  seeAllHref: string;
};

/** The next sales with the organisation's works: date, title and how many works, each a link. */
export function HomeUpcomingSales({ sales, seeAllHref }: Props) {
  if (sales.length === 0) return null;
  return (
    <HomeSection id="home-upcoming-sales" title="Upcoming sales" seeAllHref={seeAllHref}>
      <HomePanel className="overflow-hidden">
        <ul aria-labelledby="home-upcoming-sales" className="divide-y divide-border-hairline">
          {sales.map((sale) => (
            <li key={sale.id}>
              <Link
                href={sale.href}
                className={cn(
                  "group flex min-h-14 items-center gap-3 px-4 py-3 sm:px-5",
                  HOME_CELL_LINK_CLASS,
                )}
              >
                <span className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-4">
                  <time
                    dateTime={sale.dateTime}
                    className="block font-body text-sm text-on-surface-variant tabular-nums sm:w-28 sm:shrink-0"
                  >
                    {sale.date}
                  </time>
                  <span className="block font-body text-sm font-medium text-on-surface">
                    {sale.title}
                  </span>
                </span>
                <span className="shrink-0 font-body text-sm text-on-surface-variant tabular-nums">
                  {sale.works}
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </HomePanel>
    </HomeSection>
  );
}
