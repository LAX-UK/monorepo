import type { UpcomingSaleView } from "@/lib/organisation-home/organisation-dashboard-view";
import { StatusBadge } from "@auction/ui/lax";
import Link from "next/link";
import { HomeSection } from "./home-section";

type Props = {
  sales: readonly UpcomingSaleView[];
  seeAllHref: string;
};

/**
 * The next sales with the organisation's works, as cards: title, date and how many of its works
 * are in each. Two across in the column; a row to swipe on phones.
 */
export function HomeUpcomingSales({ sales, seeAllHref }: Props) {
  if (sales.length === 0) return null;
  return (
    <HomeSection
      id="home-upcoming-sales"
      title="Upcoming sales"
      link={{ href: seeAllHref, label: "All sales" }}
    >
      <ul
        aria-labelledby="home-upcoming-sales"
        className="-mx-4 grid snap-x snap-mandatory auto-cols-[17.5rem] grid-flow-col gap-4 overflow-x-auto scroll-px-4 px-4 [scrollbar-width:none] sm:mx-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-2 sm:overflow-visible sm:px-0"
      >
        {sales.map((sale) => (
          <li key={sale.id} className="snap-start">
            <Link
              href={sale.href}
              className="block h-full rounded-lax-card border border-lax-line bg-lax-surface px-5 pt-4 pb-5 transition-colors duration-150 hover:border-lax-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lax-focus"
            >
              <span className="block font-lax-display text-lax-16 font-semibold text-lax-fg">
                {sale.title}
              </span>
              <time dateTime={sale.dateTime} className="mt-0.5 block text-lax-13 text-lax-muted">
                {sale.date}
              </time>
              <StatusBadge tone="info" shape="dot" className="mt-3">
                {sale.works}
              </StatusBadge>
            </Link>
          </li>
        ))}
      </ul>
    </HomeSection>
  );
}
