import type { UpcomingSaleView } from "@/lib/organisation-home/organisation-dashboard-view";
import { Surface } from "@auction/ui/components/surface";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { HomeSectionHeading } from "./home-section-heading";
import { HomeSeeAllLink } from "./home-see-all-link";

type Props = {
  sales: readonly UpcomingSaleView[];
  seeAllHref: string;
};

/** The next sales with the organisation's works: date, title and how many works, each a link. */
export function HomeUpcomingSales({ sales, seeAllHref }: Props) {
  if (sales.length === 0) return null;
  return (
    <Surface variant="section" padding="none" className="p-0 sm:p-0">
      <div className="flex items-center justify-between gap-4 px-4 pt-4 sm:px-6 sm:pt-5">
        <HomeSectionHeading id="home-upcoming-sales">Upcoming sales</HomeSectionHeading>
        <HomeSeeAllLink href={seeAllHref} />
      </div>
      <ul
        aria-labelledby="home-upcoming-sales"
        className="divide-y divide-border-hairline px-2 pb-2 sm:px-3"
      >
        {sales.map((sale) => (
          <li key={sale.id}>
            <Link
              href={sale.href}
              className="group flex min-h-11 items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:px-3"
            >
              <span className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-4">
                <time
                  dateTime={sale.dateTime}
                  className="block font-body text-sm text-on-surface-variant tabular-nums sm:w-28 sm:shrink-0"
                >
                  {sale.date}
                </time>
                <span className="block font-body text-sm font-semibold text-on-surface">
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
    </Surface>
  );
}
